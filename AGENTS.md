# AGENTS.md — pm2

## テストを不用意に走らせない

`test/unit.sh` と `test/e2e.sh` は **`PM2_HOME` を分離していない**。開発機の実際の pm2 デーモンに
対して動き、失敗時のリトライで `pm2 kill` と `pm2 uninstall all` を実行する。手元で `npm test` /
`npm run test:unit` を叩くと、その人が動かしているプロセスが落ちる。

- 手元で全体を回すなら **`npm run test:parallel`**（Docker の中で走る。CI もこれ）。
- 単体の mocha ファイルだけ確認したいときは `npx mocha --exit <file>` を直接叩く。

テストの置き場所: 単体は `test/unit/`・`test/interface/`・`modules/*/test/`（mocha）、
E2E は `test/e2e/**/*.sh`（bash）。fixture は `test/fixtures/`。

## ever-better の対象範囲

lint / typecheck / TypeScript 移行の対象は **pm2 が所有するコード**（`lib/`, `bin/`, `modules/`,
`test/`, ルートの `index.js` / `constants.js` / `paths.js`）。

- `examples/` は **除外**。ユーザーに見せるサンプルスクリプトであって、ライブラリのソースではない。
  整形だけは当てているが、lint と型は要求しない。
- `examples/using-pm2-and-transpilers/node.d.ts` は **整形からも除外**。DefinitelyTyped の Node v6
  型定義を丸ごとコピーした第三者コードで、整形しても差分ノイズにしかならない。
- `modules/` は `pm2-axon` / `vizion` などを repo に取り込んだもの。取り込んだ時点で pm2 のコード
  なので、他と同じ扱いにする。

## 手を入れてはいけない生成ファイル

- `QUALITY.md` — `ever-better` が `.ever-better/state.json` から描き直す。`ever-better:notes`
  マーカーの間だけが手書きで生き残る。
- `.ever-better/state.json` — ledger 本体。手で数字を書き換えない。
- `eslint-suppressions.json` — 導入時点の違反数の記録。**手で編集しない**。減らすのは
  `ever-better prune`（違反を実際に直してから）。

## ルールを緩めない

CI を通すために **ルール自体を弱めない**。ignore glob を広げる、ルールを warn に落とす、
`eslint-suppressions.json` を作り直す、`ever-better freeze` を 2 回目回す — いずれも禁止。
例外は freeze の一度きり意図的に与えたもので、ルールを緩めるとそれが恒久かつ無言の免除になる。
ルールがこの repo に本当に合っていないなら、それは編集ではなく issue にする。

## ゲート

コードを変えたら、この 4 つをこの順で走らせる。

```bash
npm run format      # Prettier で整形（CI は format:check で判定）
npm run lint        # ESLint。suppressions を超えた分だけ error になる
npm run typecheck   # tsc --noEmit
npx ever-better check --no-write   # 天井を超えていないか
```

`build` script は無い。pm2 は素の JavaScript をそのまま配布していて、コンパイルする対象が無い
（TypeScript 移行が `lib/` に届いた時点で必要になる）。

**判定は終了コードで行う。** `npm run lint | tail` のようにパイプすると最後の段の終了コードが
返るため、lint が落ちていても 0 に見える。各コマンドを単独で走らせること。

経緯と全体計画は `plans/ever-better.md`。
