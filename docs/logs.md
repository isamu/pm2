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
