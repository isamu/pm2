# 作業ログ

pm2 に品質の ratchet（[ever-better](https://github.com/isamu/ever-better)）を敷き、
TypeScript 移行を始めた作業の記録。計画は [`plans/ever-better.md`](../plans/ever-better.md)、
経緯の議論は issue #1。

日付は 2026-08-08。

---

## 何をしたか

| PR  | 内容                                                      |
| --- | --------------------------------------------------------- |
| #2  | 計画・`AGENTS.md`・`ever-better diagnose` の結果          |
| #3  | Prettier を導入し 524 ファイルを整形（整形だけの単独 PR） |
| #4  | ESLint / TypeScript / CI ゲート                           |
| #5  | freeze — 違反 4942 件を天井として記録                     |
| #6  | drain — 実行時バグ 2 件をテスト付きで修正                 |
| #7  | `dist/` にコンパイルして配布物にする                      |
| #8  | TypeScript 移行 7 ファイル + バグ修正                     |
| #16 | #7/#8 で作り込んだ退行の修正                              |

数字の動き:

|             | 天井 | warning |
| ----------- | ---- | ------- |
| freeze 時点 | 4942 | 1037    |
| 現在        | 3613 | 886     |

**この差を「進捗」と読んではいけない。** 内訳は次のとおり。

| 減少                                                    | 件数 | 種類                                                                                                          |
| ------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-require-imports` を `.ts` 限定に | 1292 | **descoping**。CommonJS の `.js` では原理的に満たせず、有効なままだと新規ファイルを 1 つも追加できない        |
| `security/*` を `test/**` で範囲外に                    | 162  | **descoping**。信頼できない入力という前提がテストには無く、有効だと一時ディレクトリを触るテストが追加できない |
| 実際に直した分                                          | 数十 | 本当の drain                                                                                                  |

ratchet を「壁」にしないための判断が 2 回あった、という記録でもある。

---

## 見つけた不具合（本家報告用に issue 化済み）

| issue | 内容                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------- |
| #9    | エラー処理の中で `ReferenceError` を投げる箇所が 2 つ（`Extra.js` の `conf`、`completion.js` の `completer`） |
| #10   | `pm2 conf` が module 設定に `null` があると一覧全体クラッシュ                                                 |
| #11   | `--user constructor` が「見つかった」扱いになる（プロトタイプ経由）                                           |
| #12   | `sexec` が呼び出し側の options を書き換える / 空コマンドのガードが機能していない                              |
| #13   | CI が OpenTelemetry のテストで恒常的に赤い                                                                    |
| #14   | テストが開発者の実 pm2 デーモンを落とす / まっさらな環境で動かない                                            |
| #15   | `examples/` に古いコピーが 2 つ                                                                               |

いずれも**修正前のコードで落ちる再現テスト**を先に書いてから直した（#12 の空コマンドと
#14 は現状固定に留め、判断を本家に委ねている）。

---

## 自分で作り込んで、CI に教えられた退行

記録として残す価値があるのはこちら。3 件とも `dist/` 化の副作用で、**ビルドが通ることと
動くことは別**という一点に集約される。

### 1. ビルドが scaffolding の雛形を書き換えていた

`pm2 boilerplate` / `pm2 ecosystem` は `lib/templates` を利用者のディレクトリにコピーする。
dist ビルドがそれを tsc に通していたので、利用者の手元に `"use strict"` 付き・4 スペース
インデント・存在しない `.map` を指すコメント付きのファイルが生成されていた。

`tsconfig.build.json` から `lib/templates/**` を外し、資産コピー側で `.js` ごと複製するようにした。

### 2. docker スイートがビルドできず dist も見つけられなかった

2 通りに壊れていた。

- `npm install` が `prepare` を走らせるが、テストイメージは `package.json` だけで依存を入れて
  ソースは後からマウントする構成。tsc が存在しない tsconfig を指して**イメージビルド自体が失敗**。
- **dist を作る工程がどこにも無かった。** 各コンテナは作業ツリーの snapshot を展開して
  `bin/pm2` を実行するが、それは今 dist 経由で解決する。CI のホストは `npm install` を
  一度も走らせないのでビルドもできない。

`prepare` は入力の有無を確認してから動くようにし（publish は無条件の `prepublishOnly` に分離）、
`docker-parallel.sh` が snapshot を取る前にイメージ内で 1 回だけビルドするようにした。

### 3. `injectModules` の require を動かしたら Windows が落ちた

`ProcessUtils` を TypeScript にしたとき、`require('../modules/pm2-io-bpm')` を早期 return より
後ろに動かして「遅延ロードにした」と説明した。**間違い**だった。

```js
// 元のコード
if (process.env.pmx !== 'false') {
  const pmx = require('../modules/pm2-io-bpm');   // ← 先に require
  const hasSpecificConfig = ...;
  if (hasSpecificConfig === false) return;        // ← return はその後
```

require そのものが副作用で、agent を読み込むことが `process:exception` のフックを仕掛ける行為
だった。後ろに動かしたことで、io 設定を持たない fork 済みアプリが計装されなくなり、
`bus.fork.spec` が 30 秒 timeout で落ちた。

**気づけた理由**: `test-windows` はこのブランチの全 run で落ちていたが、dist ビルドだけの
コミットでは 3 バージョンとも success だった。その差から範囲を絞れた。

### 4. `install-otel` が build 出力にインストールしていた

`PM2_ROOT = path.join(__dirname, '..')` が、`lib/..`（リポジトリ root）から
`dist/lib/..`（= `dist/`）に変わった。`npm install` が `dist/node_modules` に入り、
次の `rm -rf dist` で消える。

同じ形を全部洗い出したところ 11 箇所あり、**root の外に出るのは 2 箇所**（`OtelManager.js` と
`LOCAL.js`）だった。残りは `lib/templates` 内など dist 内で完結するので無事。
共通ヘルパー `lib/tools/packageRoot.ts` を 1 つ作って両方に適用した。

---

## 判断のメモ

### ReDoS の指摘 16 件は、ほぼ誤検知だった

`security/detect-unsafe-regex` は `safe-regex` による star height のヒューリスティックで、
解析ではない。16 件を実測したところ**すべて線形**だった。動いている正規表現を
ヒューリスティックだけを根拠に書き換えるのは退行リスクしか無いので、代わりに
**線形であることを固定する回帰テスト**を入れた（`test/programmatic/redos_guard.mocha.js`）。

予算判定が本物の爆発を捕まえることは確認済み（`/^(a+)+$/` は 40 文字で 1 分経っても返らない）。

例外は `IsAbsolute` の 1 件で、ここは sonarjs の指摘が正しかった。Node の `splitDeviceRe` を
そのまま持ってきており、末尾の `([\s\S]*?)$` が backtracking の原因。この group は
**どこからも読まれていない**ので、判定に必要な 3 つの前方一致に分解した。

### 移行の等価性は「並べて実測」で確かめた

コンパイルが通ることは同じ挙動の証明にならない。旧実装と新実装を同じプロセスで並べて呼び、
出力を突き合わせている。

| ファイル        | 確認                                               |
| --------------- | -------------------------------------------------- |
| `paths.ts`      | 3 つの PM2_HOME × 6 つの上書きシナリオ、全キー一致 |
| `constants.ts`  | 90 キーすべて一致                                  |
| `IsAbsolute.ts` | 57122 通りの生成パス文字列で差分ゼロ               |
| `passwd.ts`     | 実 `/etc/passwd` 264 エントリで一致                |

さらに `paths` 9 件・`constants` 12 件のテストは**旧実装に対しても通る**。
テストが書き換えではなく元の仕様を書いている、という担保。

### ansis の型定義で移行が一度止まった

`ansis` は `"type": "module"` のパッケージに `index.d.ts` を 1 つだけ同梱している。
`moduleResolution: node16` では TypeScript が ESM と解決し、CommonJS からは `import` 形式でも
`import = require()` 形式でも拒否する（実際には `index.cjs` があり、ランタイムはそれを読む）。

`nodenext` は Node の require(ESM) をモデル化していて受け付ける。**出力される JavaScript は
同じ `require()` 呼び出し**なので実行時の差は無い。

### `prune` は「途中の木」を読む

編集途中で `ever-better prune` を走らせたら、ledger の baseline が実態より低い値に書き換わり、
suppressions ファイルは 1 バイトも変わっていないのに `ever-better check` が落ちた。
**prune は作業が終わってから走らせる。**

---

## まだ残っていること

- `lib/` は 78 ファイルが JavaScript のまま。`lib/Common.js` ↔ `lib/OtelManager.js` は
  循環しているので 2 つ同時に移す必要がある。
- `security/detect-object-injection` 718 件と `detect-non-literal-fs-filename` 266 件が
  ソース側に残っている。プロセスマネージャの性質上ほぼ構造的なもので、実害のある箇所
  （`passwd`）だけ個別に対処した。
- main の CI は元から赤い（issue #13）。**新しく壊れたときに気づけない**状態が続いている。
  実際この作業中、docker のイメージビルドが失敗するようになったとき「いつもの赤」と
  区別がつかず一度見落としかけた。

---

## 追記

### `Docker.js` — 3 件（issue #17）

`processCommand` が `executeRemote` の `err` を完全に無視しており、`getSystemData` が失敗すると
エラー報告ではなく `TypeError` になっていた。containers のチェック条件も逆
（`containers &&  length == 0` は containers が無いときガードを素通りする）で、
未知の action ではどの `if` にも当たらずコールバックが呼ばれないまま関数が終わっていた。

TypeScript 化は見送った。`spawn('docker', ...)` の PATH 解決を sonarjs が咎めるので
`lib/tools/which.js` を使いたいが、そのためには which を型付けする必要があり、
125 行の Windows PATHEXT 処理を無監督で変換するのは risk が見合わない。
`OtelManager` も which に依存している。

### 移行対象から外したもの

第三者コードと、利用者に配られる雛形は対象外にしている。

| 対象                                                        | 理由                            |
| ----------------------------------------------------------- | ------------------------------- |
| `lib/tools/fmt.js`                                          | MIT, Andrew Chilton             |
| `lib/tools/treeify.js`                                      | UMD の第三者ライブラリ          |
| `lib/tools/json5.js` / `isbinaryfile.js` / `promise.min.js` | 第三者                          |
| `lib/tools/copydirSync.js`                                  | `copy-dir` パッケージの取り込み |
| `lib/templates/sample-apps/**`                              | 利用者に配られる雛形            |
| `examples/**`                                               | 同上                            |

`lib/` の 83 ファイルのうち、実際の移行対象はこれらを除いた分になる。

### 5. dist に `.ts` ソースが混ざり、Bun が全滅していた

資産コピーの除外条件が `.js` と `.map` だけだったので、**`.ts` ソース 9 個が
コンパイル済み `.js` の隣に置かれていた**。

Node では単なる無駄だが、Bun では致命的だった。Bun は `./x.js` の require を
**両方あると `./x.ts` に解決する**ので、`lib/tools/sexec.ts` を読み込み、
`export =` で CommonJS になっているファイルの `import` 文で落ちる。

`Passed: 0 / 172` で全滅していたが、報告されるのは最初に終わったテストなので
`test/e2e/modules/get-set.sh` という無関係に見えるものが表に出ていた。
「全部落ちている」という数字のほうが手がかりだった。

### 6. bun イメージには npm が無い

`docker-parallel.sh` に足したビルド工程が `npm run build` 決め打ちだったが、
bun イメージは bun を入れて node にシンボリックリンクするだけで npm を持たない。
`bash: npm: command not found` で 1 件もテストが走らないまま終わっていた。
スクリプトが既にランタイム別に mocha を切り替えているのと同じ形に揃えた。

---

## dist 化で分かったこと

`dist/` を 1 階層挟む方式は、**コードが「パッケージ root にいる」前提の箇所すべてと衝突する**。
実際に踏んだのは 4 種類:

| 壊れ方                                    | 気づかせてくれたもの                      |
| ----------------------------------------- | ----------------------------------------- |
| 雛形が tsc を通って書き換わる             | 自分で書いたバイト一致テスト              |
| PM2_ROOT が build 出力を指す              | `otel-install.sh` の `Cannot find module` |
| `.ts` が dist に混ざり Bun が優先解決する | `Passed: 0 / 172` という数字              |
| ビルド工程がランタイムを仮定する          | `npm: command not found`                  |

いずれも `yarn build` は通っていた。**ビルドが通ることは動くことの証明にならない**、
という一般論の具体例が 4 つ揃った形になっている。

---

## 追記 2: `pm2 start --ext` の 2 件（issue #18）

38 行のファイルに 2 件あった。どちらもこのフラグを実質使い物にならなくする。

- `fs.statSync(folder)['mode'] & 4` — **other の読み取り権限**でスキャンを止めていた。
  pm2 が読めるかどうかは 3 行上の `accessSync(folder, R_OK)` が既に確認している。
  **0700 のディレクトリでは 1 件も見つからず、エラーも出ない。**
- 各エントリの `statSync` がリンクを辿るため、**壊れたシンボリックリンク 1 つでスキャン全体が
  例外で死ぬ**。emacs はバッファを開いている間 `.#file` → `user@host.pid` を置くので、
  誰かがファイルを開いているだけで落ちる。

### 見つかった経緯が本題

既存の `test/programmatic/flagExt.mocha.js` が、この作業環境でずっと

```
ENOENT: no such file or directory, stat '.../test/e2e/cli/.#interpreter.sh'
```

で落ちていた。最初は「環境のゴミ」として脇に置いたが、**それ自体がバグの再現**だった。
このテストは `docker-parallel.sh` の除外リストにあって CI で走っていない（issue #14 と同じ構図）。

CI から外されたテストは、落ちても誰も見ないので、**壊れていることに誰も気づかないまま残る**。
このリポジトリには除外リストに 20 個以上入っている。

---

## 追記 3: プロトタイプ経由の引きは 1 箇所ではなかった

`passwd`（issue #11）で見つけた「ユーザー入力をプレーンオブジェクトのキーにする」形は、
このコードベースに**繰り返し出てくる**。

| 場所                         | 症状                                                                 | issue |
| ---------------------------- | -------------------------------------------------------------------- | ----- |
| `passwd.getUsers()`          | `--user constructor` が「見つかった」扱いになる                      | #11   |
| `pm2-ls.js` のソート項目検証 | `--sort constructor` が `TypeError` でクラッシュ                     | #19   |
| `helpers.getNestedProperty`  | `constructor.prototype` でプロセス一覧から `Object.prototype` に到達 | #19   |

`Configuration.js` には既に `__proto__` / `constructor` / `prototype` を弾くガードがある
（CVE ではなく issue #6089 の対応）。**同じ問題が別の場所で繰り返されている**ということで、
1 箇所ずつ潰すよりも「ユーザー入力をキーにする箇所」を洗い出すほうが早い。

対処は 2 通り使い分けた:

- 引く側が固定表を持つ場合 → `Object.prototype.hasOwnProperty.call()` で own property に限定
- マップを自分で作る場合 → `Object.create(null)` でプロトタイプごと外す

## 追記 4: `pm2 ls` 周りの表示ヘルパーにはテストが 1 つも無かった

`bytesToSize` / `colorStatus` / `safe_push` / `timeSince` / `colorizedMetric` /
`getNestedProperty` — `pm2 ls` の表示を組み立てる純粋関数群だが、テストが存在しなかった。
19 件追加した。

書いていて分かったこと:

- `colorStatus` は `switch` の各 `case` で `return` した直後に `break` が置かれていた（到達しない）
- `timeSince` は「1 単位ちょうど」を次に小さい単位に落とす（`> 1` 判定）。1 日ちょうどは `24h` になる。
  意図的かどうか判断できないので**現状のままテストで固定**した
- `bytesToSize` の分岐は小さい順に並んでいて、各段で範囲の上下を両方見ていた。大きい順に
  並べ替えると上限の判定が要らなくなる（挙動は同じ）

---

## 追記 5: dist ビルドが Bun を壊していた（一番厄介だったもの）

### 症状

Bun のスイートが `Passed: 2 / 176`。作業前の main は `Passed: 82 / 159` だったので、
**明確に私が悪化させていた**。失敗するテストは毎回変わるが、いつも `test/e2e/process-file/` の
どれか。node と Windows は無事。

### 切り分け

1. 失敗したテストを Bun のコンテナで**単体実行したら通った** → 並列実行との相互作用を疑う
2. しかし `json-reload.sh` は単体でも落ちた（最初の計測はイメージビルド込みで時間切れしていただけ）
3. **`origin/main` の同じテストを同じコンテナで走らせたら exit 0** → 私の退行で確定
4. **`.ts` が 1 つも無い「dist ビルドのみ」のコミットでも同じ失敗** → 移行ではなくビルドが原因

4 が決定打だった。「自分の変更のうちどれか」を絞る前に、「そもそも変更のどの層か」を
先に切ったほうが速い。

### 原因

tsc は emit するモジュールすべてに `"use strict"` を付ける。
**pm2 の 50 ファイルは sloppy mode 前提で書かれている。**

node では差が出なかったが、Bun では出た。同じコードが同じ入力で動くかは、
ランタイムが 1 つ通っただけでは分からない。

### なぜ設定で回避できないか

`alwaysStrict: false` がその switch だが、**TypeScript 6 で非推奨、7 で廃止**。
`ignoreDeprecations` で先延ばしする以外に手が無い。つまり
**「既存の JavaScript を tsc に通す」方式に、挙動を保ったまま続けられる版は存在しない。**

### 対処

tsc は `.ts` だけコンパイルし、`.js` はバイト単位でコピーする（`allowJs: false`）。
あるモジュールは `.ts` で tsc が `.js` を出すか、`.js` でそのまま届くかのどちらかなので、
衝突は起きない。

Bun のコンテナで `json-reload` / `app-config-update` / `yaml-configuration` / `json-file`
すべて exit 0 を確認。

### 教訓

`dist/` 化で踏んだものが 5 つになった。全部 `npm run build` は通っていた。

| 壊れ方                                    | 気づかせてくれたもの                            |
| ----------------------------------------- | ----------------------------------------------- |
| 雛形が tsc を通って書き換わる             | 自分で書いたバイト一致テスト                    |
| `PM2_ROOT` が build 出力を指す            | `otel-install.sh` の `Cannot find module`       |
| `.ts` が dist に混ざり Bun が優先解決する | `Passed: 0 / 172` という数字                    |
| ビルド工程がランタイムを仮定する          | `npm: command not found`                        |
| **既存 JS が strict mode になる**         | **`82/159` → `2/176` という「前と比べた」数字** |

最後の 1 つは、**作業前の CI 結果と比べなければ「いつもの赤」と区別がつかなかった**。
main が恒常的に赤い（issue #13）と、この比較そのものが難しくなる。

---

## lib/ の TypeScript 化 — 機械的改名のあと (issue #21)

`lib/` の 49 ファイルを `git mv` で `.ts` にした時点で型エラーが 259 件。
そこから何を「機械的」と見なして自動化し、何を手で確かめたかの記録。

### 型チェッカーは何を見つけたか

**バグではなかったもの**が最も多い。TS2554（引数不足）54 件は、宣言が 9 箇所しか無く、
どれも本体が `cb ? cb(...)` や `if (!envs) envs = {}` で欠落を想定していた。
JS が optional として扱っていた引数を optional と宣言しただけで 54 件が消えた。
**emit される JS は 1 バイトも変わらない**（引数リストは実行時の挙動を持たない）。

WIP コミットで「`new Daemon()` が引数不足」と書いたのは誤りだった。`Daemon` は
`if (!opts) opts = {}` で始まっている。**型エラーを読んでバグと決めつけた**例。

**本物だったもの**は 1 件、しかも重い（issue #22）:

```js
timer = setTimeout(function () {
  if (Client.sub_sock.destroy) that.sub_sock.destroy();
```

`Client` はコンストラクタなので `Client.sub_sock` は常に undefined。
`undefined.destroy` が **タイマーの中で** 投げるので、5 行上の try/catch には入らない。
200ms 以内に閉じないソケットがあると落ちる。**このタイムアウト分岐は一度も成功したことが無い。**

### 名前空間オブジェクトの変換 — 自動化とその止め方

`Configuration` / `Modularizer` / `Monit` / `Log` は同じ形をしていた:
空オブジェクトを export して、そこにメソッドを 1 つずつ生やす。型は `{}` のまま。

codemod は「代入の数」と「トップレベルの `^};$` の数」が **一致しなければ止まる**。
これが実際に効いた:

- `Monit` は 8 代入 / 9 closer で拒否された。9 個目の正体は
  **`Object.size = function` — グローバルの `Object` への書き込み**。
  require しただけで組み込みが変わる。呼び出しは 12 行下の 1 箇所だけだった。
- `Modularizer` は変換できたが `function package(` を生んだ。`package` は strict mode の
  **将来予約語** で、`.ts` は常に strict。宣言名を分けて literal で `package: packageModule` と繋いだ。

どちらも「数を数えるだけの安いチェック」が、読んでも気づきにくいものを止めている。

### この変換の失敗モードと、それを突くテスト

メソッドを literal に入れ忘れても **どこも壊れない**。ビルドは通り、その機能を使う
コマンドだけが静かに消える。だから `test/interface/module_surface.mocha.js` は
`Object.keys(module)` を期待リストと **完全一致** で比較する。

`this` の束縛は変わらない。`Monit.reset()` と呼ぶ限り `this` は呼び出し側で決まるので、
宣言が `Monit.reset = function` でも `function reset` でも同じ。

### 「先にテストを書く」が実際に効いた場所

- `Configuration`（26 テスト）: 構造を変える前に書いて緑を確認 → 変換 → 再度緑。
  `PM2_HOME` を temp に向けて `paths`/`constants`/`Configuration` を require し直すことで、
  デーモン無しで 10 メソッド全部を回せる。
- `Object.size` の除去: 先に「require しても `Object.size` は生えない」を書いて
  **赤を見てから** 直した。
- `disconnectBus`: スタブソケットで先に書き、`Cannot read properties of undefined (reading 'destroy')`
  を再現してから直した。

赤を見ずに直したものは、直っていない可能性を排除できない。

### 検証ループ（ブランチがまだビルドを通らない間）

`npm run build` は `tsc && copy-assets` の `&&` チェーンなので、型エラーで
アセットコピーまで届かない。ただし tsc は `noEmitOnError` 無しで **emit はしている**。

```
node packager/clean-dist.mjs && npx tsc -p tsconfig.build.json ; node packager/copy-dist-assets.mjs
```

と exit code を無視して繋ぐと完全な `dist/` ができ、ユニットテストが回る。
これで **改名が実行時挙動を壊していないこと**（268 passing）を、型エラーを全部潰す前に確認できた。

### 残り

155 件。うち `God` 名前空間 34 + `God/ForkMode` 12 は、`clusters_db` の中身
（= pm2 のプロセス環境オブジェクト）に本物の型を与えないと解けない。
`{}` は `noImplicitAny: false` の下で添字アクセスが any になるため今は通っているが、
`Record<string, unknown>` にすると全部の読み出しが壊れる。ここが「機械的でない」残作業の本体。

`ProcessContainer` の 5 件は `process.send` / `process.stdout.write` の差し替えで、
**戻り値がバックプレッシャに使われる**（`write` は boolean を返す契約）。
現状の差し替えは `false | void` を返すので、型を合わせにいくと挙動が変わる。触っていない。

### 続き — 155 から 0 へ

上の「機械的でない残り」は結局全部片付いた。何がそう見えていたかの訂正を含めて記録する。

**`God`（46件）**: `clusters_db` に本物の型が要ると書いたが、要らなかった。
34件は全部 **`God` 自身の名前付きプロパティ**で、`clusters_db[id]` のような添字アクセスは
`noImplicitAny: false` の下で any になるので最初からエラーではない。
必要だったのは「7つのモジュールが後から生やすメンバーの宣言」だけ。

ただし**インターフェースに書く対象を間違えると悪化する**。最初、God.ts 自身が代入する 7 つも
インターフェースに `unknown` 引数で宣言したところ、**その型が代入先の関数本体に文脈型付けされ**、
`pm2_env.pm_out_log_path` が unknown 上のアクセスになって 34 → 64 に増えた。
同ファイル内で代入するものは関数宣言にして literal に並べ、
インターフェースは**他モジュールが生やすものだけ**にするのが正解。

**`ProcessContainer`（10件）**: `process.stdout.write` の戻り値がバックプレッシャに使われるので
触れない、と書いた。実際は上書きが **一度も true を返していない**（`undefined` / `false` / `null` が
分岐ごとに混在）。`false` に統一すれば真偽値としては完全に同じで、型だけが合う。
`true` にするのは挙動変更なので**やらなかった**。

この変更は今回いちばんリスクが高いので、**旧コードに対してテストを回して差分を見た**:

```
旧コード: 4 passing / 1 failing  ← 落ちたのは boolean を主張するテストだけ
新コード: 5 passing
```

送信転送・バス経路・ログファイル・pid ファイルの 4 つが両方で通る、が
「意図した 1 つだけが変わった」の証拠になる。テストを後から書いたときは、
**変更前のコードに当てて落ちることを確かめるまで、それは回帰テストではない**。

**`appConf`（6件）**: 1つの束縛が「パース結果 → その中の 1 キー → 1要素配列」と 3 つの形を通る。
どの型を付けても後続のループが壊れるので詰まっていたが、詰まっていたのは
**型ではなく構造**だった。正規化を `lib/tools/processFile.ts` の `appsIn` に出したら型は自明になった。

出してみて分かったのは、`_startJson` と `actionFromJson` に**同じ処理の写しが 2 つあり、
片方だけが `pm2` という旧キーを見ていた**こと。統合したので `pm2 reload` の挙動が変わる
（PR に明記）。重複を消すと差分が見つかる、の典型。

### ratchet の再 freeze で分かったこと

改名で全キーが `.js` → `.ts` になるので freeze をやり直した。天井は 3524 → 3815 に**上がった**。
上がった分は全部 **TypeScript にしか適用されないルール**:

| ルール                                                             | 増加 | なぜ                                                                                          |
| ------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-require-imports`                            | +436 | 設定で `**/*.js` にだけ off にしてある（`.ts` では live、と設定のコメント自身が予告していた） |
| `no-var` / `prefer-rest-params` / `prefer-const` / `prefer-spread` | +66  | typescript-eslint の `eslint-recommended` は TS ファイルにしか当たらない                      |

**元から真だったものが、リンタに聞かれていなかっただけ**。改名がそれを聞いた。
`.js` を `.ts` にする作業は、それ自体は挙動を変えないのに天井を上げる — この 502 件は
「増えた違反」ではなく「見えるようになった違反」であって、混ぜて記録すると後で読めなくなる。

自分の変更が足しかけた 3 件は記録せず潰した:

- `sonarjs/public-static-readonly` ×3 — `static #pm2` を「public static property」と report する
  誤検知。private 化した上でスコープ例外に理由付きで隔離した
- `id-length` ×2 — 自分が足した `cb`。`cb` を例外リストに足せば既存の違反も一緒に消えて
  天井が下がるが、それは仕事をせずに数字を良くする行為なので、**引数名を `callback` に変えた**
