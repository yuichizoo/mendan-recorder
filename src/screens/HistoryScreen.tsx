import { useEffect, useState } from 'react'
import type { HistoryRecord } from '../types'
import { INTERVIEW_TYPE_LABELS } from '../types'
import { listHistory, deleteHistory } from '../lib/db'
import { formatDuration } from '../lib/prompts/sangyoi'

interface Props {
  onOpen: (rec: HistoryRecord) => void
}

export default function HistoryScreen({ onOpen }: Props) {
  const [records, setRecords] = useState<HistoryRecord[] | null>(null)

  useEffect(() => {
    listHistory()
      .then(setRecords)
      .catch(() => setRecords([]))
  }, [])

  async function remove(id: string) {
    if (!window.confirm('この履歴を削除します。よろしいですか?')) return
    try {
      await deleteHistory(id)
      setRecords((rs) => (rs ? rs.filter((r) => r.id !== id) : rs))
    } catch {
      window.alert('削除に失敗しました。')
    }
  }

  if (records === null) {
    return (
      <div className="screen">
        <p className="empty-hint">読み込み中…</p>
      </div>
    )
  }

  return (
    <div className="screen">
      {records.length === 0 && (
        <p className="empty-hint">
          履歴はまだありません。
          <br />
          文書を生成すると、この端末内に自動保存されます。
        </p>
      )}
      {records.map((r) => {
        const d = new Date(r.generatedAt)
        const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        const typeLabel =
          r.mode === 'homon' ? '訪問診療' : INTERVIEW_TYPE_LABELS[r.interviewType ?? 'other']
        return (
          <div key={r.id} className={`history-card history-${r.mode}`}>
            <button className="history-main" onClick={() => onOpen(r)}>
              <div className="history-top">
                <span className={`history-badge badge-${r.mode}`}>{typeLabel}</span>
                <span className="history-date">{dateStr}</span>
              </div>
              <div className="history-sub">
                ID: {r.caseId || '未入力'} / 所要: {formatDuration(r.durationSec)}
              </div>
              <div className="history-snippet">{r.docText.slice(0, 60)}…</div>
            </button>
            <button className="segment-delete" onClick={() => remove(r.id)}>
              削除
            </button>
          </div>
        )
      })}
    </div>
  )
}
