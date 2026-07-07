import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Segment } from '../types'

interface Props {
  segments: Segment[]
  focusId: string | null
  onFocusDone: () => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  emptyHint: ReactNode
}

export default function SegmentList({
  segments,
  focusId,
  onFocusDone,
  onUpdate,
  onDelete,
  onAdd,
  emptyHint,
}: Props) {
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>())

  useEffect(() => {
    if (!focusId) return
    const el = textareaRefs.current.get(focusId)
    if (el) {
      el.focus()
      onFocusDone()
    }
  }, [focusId, segments, onFocusDone])

  return (
    <section className="segments">
      {segments.length === 0 && <p className="empty-hint">{emptyHint}</p>}
      {segments.map((seg) => {
        const d = new Date(seg.ts)
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        return (
          <div key={seg.id} className="segment-card">
            <div className="segment-head">
              <span className="segment-time">{time}</span>
              <button
                className="segment-delete"
                onClick={() => onDelete(seg.id)}
                aria-label="このメモを削除"
              >
                削除
              </button>
            </div>
            <textarea
              ref={(el) => {
                if (el) {
                  textareaRefs.current.set(seg.id, el)
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                } else {
                  textareaRefs.current.delete(seg.id)
                }
              }}
              className="segment-text"
              value={seg.text}
              rows={2}
              placeholder="ここに音声入力"
              onChange={(e) => {
                onUpdate(seg.id, e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
            />
          </div>
        )
      })}
      <button className="btn btn-add" onClick={onAdd}>
        + メモ追加
      </button>
    </section>
  )
}
