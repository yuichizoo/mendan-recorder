import { useState } from 'react'
import type { GenerateResult } from '../types'
import { INTERVIEW_TYPE_LABELS } from '../types'
import { formatDuration } from '../lib/prompts/sangyoi'

interface Props {
  result: GenerateResult
  onBack: () => void
  onNewInterview: () => void
}

export default function ResultScreen({ result, onBack, onNewInterview }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.docText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert('コピーに失敗しました。文書を長押しして選択コピーしてください。')
    }
  }

  const d = new Date(result.generatedAt)
  const meta = `${INTERVIEW_TYPE_LABELS[result.interviewType]} / ID: ${result.caseId || '未入力'} / 面談時間: ${formatDuration(result.durationSec)} / 生成: ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

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

      <div className="result-actions">
        <button className="btn btn-outline" onClick={onBack}>
          メモに戻る(再編集・再生成)
        </button>
        <button className="btn btn-primary" onClick={onNewInterview}>
          新しい面談を開始
        </button>
      </div>
    </div>
  )
}
