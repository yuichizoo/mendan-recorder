import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { detectSensitive, replaceAllOccurrences, KIND_LABELS } from '../lib/anonymize'
import { getCompanies } from '../lib/settings'

interface Props {
  userText: string
  sendLabel: string
  sending: boolean
  onCancel: () => void
  onSend: (finalText: string) => void
}

export default function SendPreview({ userText, sendLabel, sending, onCancel, onSend }: Props) {
  const [text, setText] = useState(userText)
  const companies = useMemo(getCompanies, [])
  const detections = useMemo(() => detectSensitive(text, companies), [text, companies])

  function replaceOne(target: string, replacement: string) {
    setText((t) => replaceAllOccurrences(t, target, replacement))
  }

  function replaceEverything() {
    let t = text
    detections.forEach((d) => {
      t = replaceAllOccurrences(t, d.text, d.replacement)
    })
    setText(t)
  }

  // 検出箇所をハイライト付きで描画
  const rendered: ReactNode[] = []
  let cursor = 0
  detections.forEach((d, i) => {
    if (d.start > cursor) rendered.push(text.slice(cursor, d.start))
    rendered.push(
      <button
        key={`${d.start}-${i}`}
        className={`hl hl-${d.kind}`}
        title={`タップで「${d.replacement}」に置換`}
        onClick={() => replaceOne(d.text, d.replacement)}
      >
        {d.text}
        <span className="hl-kind">{KIND_LABELS[d.kind]}</span>
      </button>,
    )
    cursor = d.end
  })
  if (cursor < text.length) rendered.push(text.slice(cursor))

  return (
    <div className="preview-overlay">
      <div className="preview-inner">
        <h2 className="preview-title">送信前の確認</h2>
        <p className="preview-note">
          以下の内容が外部API(Anthropic)に送信されます。色付きの箇所は個人情報の可能性があります。
          <strong>タップすると「A氏」「B社」等に一括置換</strong>されます。
          検出は完璧ではないため、目視でもご確認ください。
        </p>

        {detections.length > 0 ? (
          <div className="preview-status preview-status-warn">
            <span>
              {detections.length}件の候補を検出(氏名・電話・住所・企業名など)
            </span>
            <button className="btn-mini" onClick={replaceEverything}>
              すべて置換
            </button>
          </div>
        ) : (
          <div className="preview-status preview-status-ok">
            自動検出: なし(目視確認のうえ送信してください)
          </div>
        )}

        <div className="preview-text">{rendered}</div>

        <div className="preview-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={sending}>
            キャンセル(メモに戻る)
          </button>
          <button className="btn btn-generate" onClick={() => onSend(text)} disabled={sending}>
            {sending ? '生成中…' : sendLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
