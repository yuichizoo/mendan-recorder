import { useState } from 'react'
import type { HistoryRecord } from '../types'
import { INTERVIEW_TYPE_LABELS } from '../types'
import { formatDuration } from '../lib/prompts/sangyoi'
import { ApiError } from '../lib/api'

interface Props {
  result: HistoryRecord
  onBack: () => void
  onNewInterview: () => void
  onRegenerate: () => Promise<void>
}

export default function ResultScreen({ result, onBack, onNewInterview, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.docText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert('コピーに失敗しました。文書を長押しして選択コピーしてください。')
    }
  }

  async function regenerate() {
    if (!window.confirm('同じ送信内容でもう一度生成します(API利用料がかかります)。よろしいですか?'))
      return
    setRegenerating(true)
    setRegenError(null)
    try {
      await onRegenerate()
    } catch (e) {
      setRegenError(e instanceof ApiError ? e.message : '再生成に失敗しました。')
    } finally {
      setRegenerating(false)
    }
  }

  const d = new Date(result.generatedAt)
  const typeLabel =
    result.mode === 'homon'
      ? '訪問診療カルテ'
      : INTERVIEW_TYPE_LABELS[result.interviewType ?? 'other']
  const meta = `${typeLabel} / ID: ${result.caseId || '未入力'} / 所要: ${formatDuration(result.durationSec)} / 生成: ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <div className="screen">
      <p className="result-meta">{meta}</p>

      <button className={`btn btn-generate ${copied ? 'btn-copied' : ''}`} onClick={copy}>
        {copied ? '✓ コピーしました' : '文書をコピー'}
      </button>

      <pre className="doc-text">{result.docText}</pre>

      {result.checkText && (
        <div className="check-box">
          <p className="check-title">要確認(コピーには含まれません)</p>
          <pre className="check-text">{result.checkText}</pre>
        </div>
      )}

      {regenError && (
        <div className="error-box">
          <p>{regenError}</p>
        </div>
      )}

      <div className="result-actions">
        <button className="btn btn-outline" onClick={regenerate} disabled={regenerating}>
          {regenerating ? '再生成中…' : '同じ内容で再生成'}
        </button>
        <button className="btn btn-outline" onClick={onBack} disabled={regenerating}>
          メモに戻る(再編集・再生成)
        </button>
        <button className="btn btn-primary" onClick={onNewInterview} disabled={regenerating}>
          {result.mode === 'homon' ? '次の患者へ(メモをクリア)' : '新しい面談を開始'}
        </button>
      </div>
    </div>
  )
}
