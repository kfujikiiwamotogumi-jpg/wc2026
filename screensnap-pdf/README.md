# ScreenSnap PDF

> 範囲を選択したら、それがそのままPDFになる。撮影 → PDF化を **1アクション** で完結させる Windows 常駐ツール。

仕様の全文は [`docs/SPEC.md`](docs/SPEC.md)（引き継ぎ書 仕様確定版）を参照してください。

## これは何か

スクショ → 画像保存 → PDF変換、という手数をゼロにするためのツールです。タスクトレイに常駐し、
ホットキーで「キャプチャーモード」に入ると、画面上に **用紙比率の枠** が現れます。狙った場所で
左クリックすれば、その範囲がそのまま **1枚のPDFとして即保存** されます。位置を変えて左クリックを
繰り返せば、ウェブカタログのページ送りのように何枚でも連続キャプチャできます。

## 技術スタック

- Electron + React + TypeScript（`electron-vite` ベース）
- 画面取得: Electron `desktopCapturer` + `nativeImage`
- PDF生成: [`pdf-lib`](https://pdf-lib.js.org/)
- 設定永続化: `electron-store`
- 配布: `electron-builder`（Windows NSIS インストーラー）
- 通信なし・完全オフライン

## セットアップ

> 対象は Windows 10 / 11（64bit）です。開発・実行は Windows 上で行ってください。

```bash
cd screensnap-pdf
npm install          # 依存関係のインストール（初回は Electron バイナリを取得します）
npm run dev          # 開発起動（トレイに常駐）
npm run typecheck    # 型チェック
npm run build        # main / preload / renderer をビルド
npm run dist         # Windows 用 .exe インストーラーを release/ に生成
```

## 使い方

1. 起動するとタスクトレイに常駐します（ウィンドウは出ません）。
2. ホットキー（既定 `Ctrl+Shift+S`）でキャプチャーモードに入ります。トレイアイコンのクリックでも可。
3. 小さな設定パネルが開きます。用紙サイズ / 向き / モード / 保存先を、撮りながら調整できます。
4. **モードB（用紙サイズ固定枠・本命）**: カーソルに枠が追従。ホイールで拡縮（縦横比は用紙比のまま維持）。
   左クリックで撮影 → 即PDF保存。位置を変えて連発できます。
5. **モードA（自由ドラッグ）**: 好きな範囲をドラッグで選んで撮影。
6. 右クリックで「終了しますか？」の確認 → 終了でキャプチャーモードを抜けます（`Esc` でも終了）。

保存ファイルは設定した保存先フォルダ（既定: `ピクチャ/ScreenSnap PDF`）に
1 撮影ごとに 1 ファイルずつ出力されます。ファイル名は **日時自動** または **連番** を選べます。

## プロジェクト構成

```
screensnap-pdf/
├─ src/
│  ├─ main/            # メインプロセス（トレイ・ホットキー・キャプチャ・PDF・設定）
│  │  ├─ index.ts      # アプリ起動とウィンドウ/IPC統括
│  │  ├─ capture.ts    # 画面取得 → クロップ → PDF保存
│  │  ├─ store.ts      # 設定の永続化
│  │  └─ tray-icon.ts  # トレイアイコン
│  ├─ preload/         # contextBridge で renderer に公開する API
│  ├─ renderer/        # 2つのウィンドウ
│  │  ├─ settings.html / src/settings/  # 設定パネル
│  │  └─ overlay.html  / src/overlay/   # 画面上のキャプチャ枠
│  └─ shared/          # main/renderer 共通（型・用紙定義・IPCチャンネル）
├─ docs/SPEC.md        # 引き継ぎ書（仕様確定版）
└─ electron-builder.yml
```

## 現状のスコープと仕様との差分

この第一弾は **写真（スクショ）方式** を実装したものです。仕様書のうち、以下は意図的に
未実装 / 簡略化しています。

- **「待機中に任意のキー」でモード突入**: Electron の `globalShortcut` では任意キーの捕捉が
  できないため、**設定可能な単一ホットキー**（既定 `Ctrl+Shift+S`）で代替しています。
- **Sharp による画像処理**: 現状はクロップに Electron `nativeImage` を使用しています。
  高度な後処理が必要になった時点で Sharp を導入予定です。
- **OCR ファイル名 / プリンター方式（仕様 8.）**: 未着手。次フェーズの検討対象です。

## 次の論点（仕様 8. より）

スクショ方式は手軽だが画面解像度どまりで拡大に弱い、という課題があります。高画質化のために
**プリンター方式**（Microsoft Print to PDF → アプリで高精細プレビュー → 枠で範囲切り出し）の
取り込みが次回の論点です。詳細は [`docs/SPEC.md` 8章](docs/SPEC.md#8-検討中の論点次回ここから) を参照。
