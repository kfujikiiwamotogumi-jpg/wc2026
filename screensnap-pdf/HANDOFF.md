# ScreenSnap PDF — セッション引き継ぎ書

最終更新: 2026-06-25 / ブランチ: `claude/new-session-x5j72u`

このファイルは、新しいセッションで作業を続けるための引き継ぎメモです。
**新セッションを始めたら、まずこのファイルを読んでください。**

---

## 0. いま何をしているか（一言）

引き継ぎ書（`screensnap-pdf/docs/SPEC.md`）に基づき、**ScreenSnap PDF**
（範囲を選択したら、それがそのままPDFになる Windows 常駐ツール）を
Electron + React + TypeScript で開発中。スクショ方式の初期版が実装・push 済み。

> 注: このリポジトリ `wc2026` のルートにある `index.html`（W杯2026の日程アプリ）は
> ScreenSnap PDF とは**無関係**。混在を避けるため ScreenSnap PDF は
> `screensnap-pdf/` サブディレクトリに隔離している。触らないこと。

---

## 1. 実装済みの内容（`screensnap-pdf/`）

スクショ方式（写真方式）の初期スキャフォールド。`npm run typecheck` と
`npm run build` は通過済み（Linux 環境のため、実際の起動・撮影確認は Windows 必須）。

- **トレイ常駐 + グローバルホットキー**でキャプチャーモード突入（`src/main/index.ts`）
- **設定パネル**ウィンドウ: 用紙サイズ / 向き / モードA・B / 保存先 / ファイル名
  （`src/renderer/src/settings/`）
- **オーバーレイ枠**（`src/renderer/src/overlay/`）
  - モードB（本命）: 用紙比固定・カーソル追従・ホイール拡縮・左クリックで連続撮影
  - モードA: 自由ドラッグ選択
  - 右クリック → 終了確認ダイアログ（`Esc` でも終了）
- **撮影 → 即PDF**: `desktopCapturer` + `nativeImage` で取得・クロップ →
  `pdf-lib` で用紙サイズの1枚PDFに保存（`src/main/capture.ts`）
- 設定永続化 `electron-store`（`src/main/store.ts`）、配布 `electron-builder`

### 主要ファイル
```
screensnap-pdf/
├─ src/main/{index,capture,store,tray-icon}.ts
├─ src/preload/index.ts
├─ src/renderer/{settings,overlay}.html + src/{settings,overlay}/
├─ src/shared/{types,paper,ipc}.ts
├─ docs/SPEC.md        # 引き継ぎ書（仕様確定版）全文
└─ README.md           # セットアップ・使い方・仕様との差分
```

---

## 2. 確定済みの仕様判断

- **突入キー**: 単一ホットキー（既定 `Ctrl+Shift+S`・設定で変更可）。
  仕様の「任意のキー」は Electron 標準では捕捉不可のため代替。
- **ファイル名**: 日時自動（既定）／連番、設定で切替。OCR は後回し。
- **マルチモニター**: 全モニターにオーバーレイを出す対応済み。
- **用紙サイズ**: A3/A4/A5/B4/B5/Letter を用意（`src/shared/paper.ts`）。

---

## 3. 保留中の最大の論点（次の意思決定）

**画質方針**（SPEC.md 8章「次回ここから」）。ユーザーと未決定:

1. スクショ方式のまま完成させる（実装済み・手軽だが拡大に弱い）
2. **Print to PDF 併用の段階案**: Microsoft Print to PDF でPDF化 → アプリにD&D →
   高精細プレビュー → 枠で範囲切り出し（ドライバー開発なしで高画質×範囲選択を両立）
3. 仮想プリンター自作（最高画質だが C++ 等・難易度大）

ユーザーの現在の意向: 既存アプリ **「Print Dock」** のソースを参照して、D&D や
PDFプレビューの実装を ScreenSnap PDF に流用できるか検討したい。

---

## 4. 次のセッションでやること（最優先）

ユーザーが **Print Dock のソース**（zip もしくは主要ファイル）を**添付アップロード**する予定。
※ ローカルパス `C:\Users\k1fuj\Documents\claud code\PrintDock` は私から読めないため、
　 チャットへの添付が必要、と案内済み。

添付が届いたら:
1. Print Dock の構成（`package.json`・main エントリ・D&D・PDFプレビュー周り）を読む
2. ScreenSnap PDF への流用・連携可否を具体的にレビュー
3. それを材料に「画質方針」を決定し、実装方針を確定

---

## 5. 開発コマンド（`screensnap-pdf/` 内）

```bash
npm install        # 初回。Electron バイナリ取得（Windowsで実行推奨）
npm run dev        # 開発起動（トレイ常駐）
npm run typecheck  # 型チェック
npm run build      # main/preload/renderer をビルド
npm run dist       # Windows .exe インストーラを release/ に生成
```

---

## 6. Git / ブランチ規約

- 作業ブランチ: **`claude/new-session-x5j72u`**（このブランチで開発・push）
- PR は明示的な依頼があるまで作らない。
