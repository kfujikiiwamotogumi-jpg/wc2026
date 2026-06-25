import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, CaptureRect } from '@shared/types'
import { getPaper, paperAspect } from '@shared/paper'

interface Pt {
  x: number
  y: number
}

export function Overlay(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [cursor, setCursor] = useState<Pt>({ x: -1000, y: -1000 })
  const [frameLong, setFrameLong] = useState(600)
  const [drag, setDrag] = useState<{ start: Pt; cur: Pt } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [flash, setFlash] = useState(0)
  const busy = useRef(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout>>()

  // 初期化：担当ディスプレイと設定を取得。
  useEffect(() => {
    window.api.getOverlayInit().then((init) => {
      setSettings(init.settings)
      setFrameLong(init.settings.fixedFrameLongPx)
    })
    const off = window.api.onSettingsChanged((s) => setSettings(s))
    return off
  }, [])

  // フレームの長辺サイズを設定に保存（ホイール操作のたびにdebounce）。
  const persistFrameLong = useCallback((v: number) => {
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      window.api.updateSettings({ fixedFrameLongPx: Math.round(v) })
    }, 400)
  }, [])

  const triggerFlash = useCallback(() => {
    setFlash((n) => n + 1)
  }, [])

  // 矩形を渡して撮影 → 即PDF（仕様 5.）。
  const doCapture = useCallback(async (rect: CaptureRect) => {
    if (busy.current) return
    if (rect.width < 6 || rect.height < 6) return
    busy.current = true
    triggerFlash()
    try {
      await window.api.capture(rect)
    } finally {
      busy.current = false
    }
  }, [triggerFlash])

  const requestExit = useCallback(() => {
    window.api.exitCapture()
  }, [])

  // ---- 用紙比に基づく固定枠サイズ ----
  const aspect = settings ? paperAspect(getPaper(settings.paperId), settings.orientation) : 0.707
  const frame = computeFrame(frameLong, aspect)

  // ---- マウス・キー操作 ----
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setCursor({ x: e.clientX, y: e.clientY })
      if (drag) setDrag({ start: drag.start, cur: { x: e.clientX, y: e.clientY } })
    },
    [drag]
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || !settings) return // 左クリックのみ
      if (settings.mode === 'free') {
        setDrag({ start: { x: e.clientX, y: e.clientY }, cur: { x: e.clientX, y: e.clientY } })
      }
    },
    [settings]
  )

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!settings) return
      if (settings.mode === 'fixed') {
        if (e.button !== 0) return
        // 固定枠：カーソル中心の枠をそのまま撮影。
        void doCapture({
          x: cursor.x - frame.w / 2,
          y: cursor.y - frame.h / 2,
          width: frame.w,
          height: frame.h
        })
      } else if (settings.mode === 'free' && drag) {
        const r = rectFromDrag(drag)
        setDrag(null)
        void doCapture(r)
      }
    },
    [settings, cursor, frame, drag, doCapture]
  )

  // 右クリック → 終了確認（仕様 2.）。
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setConfirming(true)
  }, [])

  // ホイールで枠を拡縮（縦横比は維持。仕様 2.）。
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!settings || settings.mode !== 'fixed') return
      const factor = 1 - e.deltaY * 0.0015
      setFrameLong((prev) => {
        const next = Math.min(4000, Math.max(60, prev * factor))
        persistFrameLong(next)
        return next
      })
    },
    [settings, persistFrameLong]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (confirming) setConfirming(false)
        else requestExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming, requestExit])

  if (!settings) return <div className="surface fixed" />

  const showFixedFrame = settings.mode === 'fixed' && !confirming
  const dragRect = settings.mode === 'free' && drag ? rectFromDrag(drag) : null

  return (
    <div
      className={`surface ${settings.mode}`}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
    >
      <div className="hud">
        {settings.mode === 'fixed'
          ? `${settings.paperId}・${settings.orientation === 'portrait' ? '縦' : '横'}｜ホイール=拡縮 / 左クリック=撮影 / 右クリック=終了`
          : `自由ドラッグ｜ドラッグで範囲選択 / 右クリック=終了`}
      </div>

      {showFixedFrame && (
        <Frame
          left={cursor.x - frame.w / 2}
          top={cursor.y - frame.h / 2}
          width={frame.w}
          height={frame.h}
          label={`${settings.paperId} ${Math.round(frame.w)}×${Math.round(frame.h)}`}
        />
      )}

      {dragRect && (
        <Frame
          left={dragRect.x}
          top={dragRect.y}
          width={dragRect.width}
          height={dragRect.height}
          label={`${Math.round(dragRect.width)}×${Math.round(dragRect.height)}`}
        />
      )}

      <div key={flash} className={`flash${flash ? ' on' : ''}`} />

      {confirming && (
        <div className="confirm">
          <div className="confirm-box">
            <p>キャプチャーモードを終了しますか？</p>
            <div className="confirm-actions">
              <button className="yes" onClick={requestExit}>
                終了する
              </button>
              <button className="no" onClick={() => setConfirming(false)}>
                続ける
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Frame(props: {
  left: number
  top: number
  width: number
  height: number
  label: string
}): JSX.Element {
  return (
    <div
      className="frame"
      style={{ left: props.left, top: props.top, width: props.width, height: props.height }}
    >
      <span className="badge">{props.label}</span>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
    </div>
  )
}

/** 長辺(px)と縦横比(w/h)から枠の幅・高さを求める */
function computeFrame(long: number, aspect: number): { w: number; h: number } {
  if (aspect <= 1) {
    // 縦長：高さが長辺
    return { w: long * aspect, h: long }
  }
  // 横長：幅が長辺
  return { w: long, h: long / aspect }
}

function rectFromDrag(d: { start: Pt; cur: Pt }): CaptureRect {
  return {
    x: Math.min(d.start.x, d.cur.x),
    y: Math.min(d.start.y, d.cur.y),
    width: Math.abs(d.cur.x - d.start.x),
    height: Math.abs(d.cur.y - d.start.y)
  }
}
