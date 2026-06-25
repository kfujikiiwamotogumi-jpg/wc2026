import { useEffect, useRef, useState } from 'react'
import type { AppSettings, CaptureResult } from '@shared/types'
import { PAPER_SIZES } from '@shared/paper'

export function Settings(): JSX.Element {
  const [s, setS] = useState<AppSettings | null>(null)
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    window.api.getSettings().then(setS)
    const off = window.api.onCaptureDone((r: CaptureResult) => {
      if (r.ok) showToast(`保存しました: ${shortPath(r.filePath ?? '')}`, false)
      else showToast(`保存に失敗: ${r.error ?? '不明なエラー'}`, true)
    })
    return off
  }, [])

  function showToast(msg: string, err: boolean): void {
    setToast({ msg, err })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  // 変更を main に反映し、ローカルにも反映。
  async function patch(p: Partial<AppSettings>): Promise<void> {
    const next = await window.api.updateSettings(p)
    setS(next)
  }

  async function chooseDir(): Promise<void> {
    const next = await window.api.chooseDir()
    setS(next)
  }

  if (!s) return <div className="app">読み込み中…</div>

  return (
    <div className="app">
      <div className="title">📄 ScreenSnap PDF</div>
      <div className="subtitle">範囲を選択したら、それがそのままPDFになる</div>

      {/* キャプチャモード（仕様 3.） */}
      <div className="field">
        <label>キャプチャモード</label>
        <div className="seg">
          <button
            className={s.mode === 'fixed' ? 'active' : ''}
            onClick={() => patch({ mode: 'fixed' })}
          >
            用紙サイズ固定枠（B）
          </button>
          <button
            className={s.mode === 'free' ? 'active' : ''}
            onClick={() => patch({ mode: 'free' })}
          >
            自由ドラッグ（A）
          </button>
        </div>
      </div>

      {/* 用紙サイズ（仕様 4.） */}
      <div className="field">
        <label>用紙サイズ</label>
        <select value={s.paperId} onChange={(e) => patch({ paperId: e.target.value })}>
          {PAPER_SIZES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* 向き（仕様 4.） */}
      <div className="field">
        <label>向き</label>
        <div className="seg">
          <button
            className={s.orientation === 'portrait' ? 'active' : ''}
            onClick={() => patch({ orientation: 'portrait' })}
          >
            縦
          </button>
          <button
            className={s.orientation === 'landscape' ? 'active' : ''}
            onClick={() => patch({ orientation: 'landscape' })}
          >
            横
          </button>
        </div>
      </div>

      {/* ファイル名（仕様 5.） */}
      <div className="field">
        <label>ファイル名</label>
        <div className="seg">
          <button
            className={s.naming === 'datetime' ? 'active' : ''}
            onClick={() => patch({ naming: 'datetime' })}
          >
            日時自動
          </button>
          <button
            className={s.naming === 'sequential' ? 'active' : ''}
            onClick={() => patch({ naming: 'sequential' })}
          >
            連番
          </button>
        </div>
      </div>

      {/* 保存先フォルダ（仕様 4.） */}
      <div className="field">
        <label>保存先フォルダ</label>
        <div className="dir">
          <input type="text" value={s.saveDir} readOnly title={s.saveDir} />
          <button className="btn" onClick={chooseDir}>
            変更
          </button>
        </div>
        <button
          className="btn"
          style={{ marginTop: 6, width: '100%' }}
          onClick={() => window.api.openSaveDir()}
        >
          保存先フォルダを開く
        </button>
      </div>

      <div className="hint">
        枠＝マウス追従／ホイールで拡縮／左クリックで撮影・即PDF保存／右クリックで終了。
        <br />
        撮影のたびに 1 ファイルずつ完結します。
      </div>

      {toast && <div className={`toast show${toast.err ? ' err' : ''}`}>{toast.msg}</div>}
    </div>
  )
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.slice(-2).join('/')
}
