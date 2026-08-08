# ever-better を pm2 に導入する

`ever-better` は「既存の違反を今日の数で天井として記録し、天井は下がることはあっても上がらない」
という ratchet を repo に敷くためのツール。pm2 は 558 ファイル・ESLint / Prettier / TypeScript が
いずれも無い状態なので、順に足していく。

## 現状（`ever-better diagnose`, commit 31adee80 時点）

| 項目 | 状態 |
| --- | --- |
| 言語 | JavaScript（TS は `types/index.d.ts` のみ、1%） |
| ESLint / Prettier | 無し |
| test | mocha + bash（`test/unit.sh`, `test/e2e.sh`, docker 版 `test:parallel`） |
| package scripts | `format` / `lint` / `build` / `typecheck` 無し |
| CI | ubuntu + windows で test のみ。lint / typecheck / gate 無し |
| 600 行超 | 14 ファイル（`lib/API.js` 1933 行が最大） |

gap は 12 件。`.ever-better/state.json` と `QUALITY.md` に記録済み。

## 対象範囲

`ever-better` の対象は **pm2 が所有するコード** に限る。

| ディレクトリ | format | lint / typecheck / TS 移行 | 理由 |
| --- | --- | --- | --- |
| `lib/` (83), `bin/`, `index.js`, `constants.js`, `paths.js` | ○ | ○ | pm2 本体 |
| `modules/` (190) | ○ | ○ | `pm2-axon` / `vizion` 等を repo に取り込んだもので、今は pm2 のコード |
| `test/` (183) | ○ | ○ | 自前のテスト |
| `examples/` (115) | ○ | **×** | ユーザーに見せるサンプル。ライブラリのソースではない |
| `examples/using-pm2-and-transpilers/node.d.ts` | **×** | × | DefinitelyTyped の Node v6 型定義の丸ごとコピー（第三者コード） |

## フェーズと PR

1 フェーズ = 1 PR。整形は必ず単独で出す。

| # | PR | 内容 |
| --- | --- | --- |
| 1 | prepare | この計画・`AGENTS.md`・`QUALITY.md`・`.ever-better/state.json` |
| 2 | format | Prettier 設定 + 全ファイル整形。**整形以外を一切含めない** |
| 3 | bootstrap | ESLint / TypeScript / `format` `lint` `build` `typecheck` script / CI に lint・typecheck・macos・`ever-better check` を追加 |
| 4 | freeze | `eslint-suppressions.json` を生成し、今日の違反数を天井として固定 |
| 5+ | migrate | `ever-better migrate` の依存順に沿って `lib/` から `.ts` へ。1 PR = 数ファイル |

## 判断のメモ

- **整形 PR が巨大になるのは想定どおり**。単独 PR にすることで、以降の lint 差分が読める状態になる。
- **`eslint-suppressions.json` はコミットする**。ハックではなく「導入時点の違反数の記録」で、
  これが無いと ratchet が成立しない。
- **溜まった違反は締切のある TODO ではない**。天井であって、価値は「新しいコードが天井を上げなく
  なった瞬間」に出る。急いで drain する必要はない。
- **TypeScript 移行は葉から**。依存順を守らないと `tsc` が通らない。`lib/` の 83 ファイルが本丸で、
  `examples/` は対象外なので、当初見えていた 558 ファイルより実際の移行対象はずっと小さい。

## やらないこと

- CI を通すためにルールを緩める（ignore glob を広げる・ルールを warn に落とす・suppressions を
  再生成する）。例外は freeze の一度だけ意図的に与えたもので、ルールを緩めると恒久かつ無言の免除になる。
- `ever-better freeze` を 2 回目を回す。天井が上がってしまう。下げるのは `ever-better prune`。
