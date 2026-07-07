import { useEffect, useRef, useState } from 'react'
import type {
  GenerateResult,
  InterviewType,
  Judgment,
  MeasureKey,
  SangyoiDraft,
  Segment,
  WorkClass,
} from '../types'
import {
  EMPTY_JUDGMENT,
  INTERVIEW_TYPE_LABELS,
  MEASURES,
  PERIOD_PRESETS,
  WORK_CLASS_LABELS,
} from '../types'
import { useTimer, formatTimer } from '../hooks/useTimer'
import { generateText, ApiError, MODEL_CHECK } from '../lib/api'
import {
  buildSangyoiSystem,
  buildSangyoiUser,
  buildCheckSystem,
  buildCheckUser,
} from '../lib/prompts/sangyoi'

const DRAFT_KEY = 'mr_draft_sangyoi'

const QUICK_TAGS = [
  '残業時間',
  '睡眠',
  '食欲',
  '疲労蓄積',
  '業務内容',
  '通勤',
  '既往・服薬',
  '本人の希望',
  '家庭状況',
]

function loadDraft(): SangyoiDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SangyoiDraft>
      return {
        interviewType: parsed.interviewType ?? 'choki',
        caseId: parsed.caseId ?? '',
        segments: parsed.segments ?? [],
        elapsedSec: parsed.elapsedSec ?? 0,
        judgment: { ...EMPTY_JUDGMENT, ...parsed.judgment },
      }
    }
  } catch {
    // 壊れたデータは捨てて新規開始
  }
  return { interviewType: 'choki', caseId: '', segments: [], elapsedSec: 0, judgment: { ...EMPTY_JUDGMENT } }
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface Props {
  onGenerated: (result: GenerateResult) => void
}

export default function RecordScreen({ onGenerated }: Props) {
  const [draft, setDraft] = useState<SangyoiDraft>(loadDraft)
  const timer = useTimer(draft.elapsedSec)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [judgmentOpen, setJudgmentOpen] = useState(false)
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>())
  const checkPanelRef = useRef<HTMLDivElement>(null)

  // メモが電波・障害で失われないよう常にローカル保存
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, elapsedSec: timer.elapsedSec }))
  }, [draft, timer.elapsedSec])

  useEffect(() => {
    if (!focusId) return
    const el = textareaRefs.current.get(focusId)
    if (el) {
      el.focus()
      setFocusId(null)
    }
  }, [focusId, draft.segments])

  const usedTags = new Set(
    QUICK_TAGS.filter((tag) => draft.segments.some((s) => s.text.includes(`【${tag}】`))),
  )

  function addSegment(prefix = '') {
    const last = draft.segments[draft.segments.length - 1]
    if (prefix && last && !last.text.trim()) {
      updateSegment(last.id, prefix + last.text)
      setFocusId(last.id)
      return
    }
    const seg: Segment = { id: newId(), ts: Date.now(), text: prefix }
    setDraft((d) => ({ ...d, segments: [...d.segments, seg] }))
    setFocusId(seg.id)
  }

  function updateSegment(id: string, text: string) {
    setDraft((d) => ({
      ...d,
      segments: d.segments.map((s) => (s.id === id ? { ...s, text } : s)),
    }))
  }

  function deleteSegment(id: string) {
    setDraft((d) => ({ ...d, segments: d.segments.filter((s) => s.id !== id) }))
  }

  function clearAll() {
    if (!window.confirm('メモ・就業判定・面談時間をすべてクリアします。よろしいですか?')) return
    timer.reset()
    setDraft({
      interviewType: draft.interviewType,
      caseId: '',
      segments: [],
      elapsedSec: 0,
      judgment: { ...EMPTY_JUDGMENT },
    })
    setError(null)
  }

  function setJudgment(patch: Partial<Judgment>) {
    setDraft((d) => ({ ...d, judgment: { ...d.judgment, ...patch } }))
  }

  function toggleMeasure(key: MeasureKey) {
    setDraft((d) => {
      const has = d.judgment.measures.includes(key)
      return {
        ...d,
        judgment: {
          ...d.judgment,
          measures: has
            ? d.judgment.measures.filter((k) => k !== key)
            : [...d.judgment.measures, key],
        },
      }
    })
  }

  function judgmentSummary(j: Judgment): string {
    const parts: string[] = []
    if (j.workClass) parts.push(WORK_CLASS_LABELS[j.workClass])
    if (j.measures.length > 0) parts.push(`措置${j.measures.length}件`)
    const period = j.period === 'custom' ? j.periodCustom : j.period
    if (period) parts.push(period)
    return parts.length > 0 ? parts.join(' / ') : '未入力'
  }

  const hasContent = draft.segments.some((s) => s.text.trim())

  async function runCheck() {
    setChecking(true)
    setCheckError(null)
    try {
      const text = await generateText({
        model: MODEL_CHECK,
        maxTokens: 300,
        system: buildCheckSystem(draft.interviewType),
        user: buildCheckUser(draft.interviewType, draft.segments),
      })
      setCheckResult(text.trim())
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '予期しないエラーが発生しました。'
      setCheckError(msg)
      setCheckResult(null)
    } finally {
      setChecking(false)
      setTimeout(() => checkPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
  }

  async function generate() {
    timer.pause()
    setGenerating(true)
    setError(null)
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    try {
      const raw = await generateText({
        system: buildSangyoiSystem(draft.interviewType),
        user: buildSangyoiUser({
          type: draft.interviewType,
          caseId: draft.caseId,
          dateStr,
          durationSec: timer.elapsedSec,
          segments: draft.segments,
          judgment: draft.judgment,
        }),
      })
      const marker = '---要確認---'
      const idx = raw.indexOf(marker)
      const docText = (idx >= 0 ? raw.slice(0, idx) : raw).trim()
      const checkText = idx >= 0 ? raw.slice(idx + marker.length).trim() : ''
      onGenerated({
        mode: 'sangyoi',
        interviewType: draft.interviewType,
        caseId: draft.caseId,
        docText,
        checkText,
        generatedAt: Date.now(),
        durationSec: timer.elapsedSec,
      })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '予期しないエラーが発生しました。'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="screen">
      <section className="timer-bar">
        <span className={`timer-display ${timer.running ? 'timer-running' : ''}`}>
          {formatTimer(timer.elapsedSec)}
        </span>
        {!timer.running ? (
          <button className="btn btn-primary" onClick={timer.start}>
            {timer.elapsedSec > 0 ? '再開' : '面談開始'}
          </button>
        ) : (
          <button className="btn btn-outline" onClick={timer.pause}>
            一時停止
          </button>
        )}
        <button className="btn btn-ghost" onClick={clearAll}>
          クリア
        </button>
      </section>

      <section className="field-row">
        <label className="field-label">面談種別</label>
        <div className="chip-row">
          {(Object.keys(INTERVIEW_TYPE_LABELS) as InterviewType[]).map((t) => (
            <button
              key={t}
              className={`chip ${draft.interviewType === t ? 'chip-active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, interviewType: t }))}
            >
              {INTERVIEW_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <section className="field-row">
        <label className="field-label" htmlFor="case-id">
          対象者ID(氏名は入力しない)
        </label>
        <input
          id="case-id"
          className="text-input"
          type="text"
          placeholder="例: A-042、T.K.様"
          value={draft.caseId}
          onChange={(e) => setDraft((d) => ({ ...d, caseId: e.target.value }))}
        />
      </section>

      <section className="field-row">
        <label className="field-label">クイックタグ(タップで新規メモに挿入)</label>
        <div className="chip-row">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              className={`chip chip-tag ${usedTags.has(tag) ? 'chip-used' : ''}`}
              onClick={() => addSegment(`【${tag}】`)}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section className="segments">
        {draft.segments.length === 0 && (
          <p className="empty-hint">
            「+ メモ追加」を押してから、キーボードのマイクで音声入力してください。
            <br />
            ディクテーションが途切れたら、次のメモで再開すればOKです。
          </p>
        )}
        {draft.segments.map((seg) => {
          const d = new Date(seg.ts)
          const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          return (
            <div key={seg.id} className="segment-card">
              <div className="segment-head">
                <span className="segment-time">{time}</span>
                <button
                  className="segment-delete"
                  onClick={() => deleteSegment(seg.id)}
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
                  updateSegment(seg.id, e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
              />
            </div>
          )
        })}
        <button className="btn btn-add" onClick={() => addSegment()}>
          + メモ追加
        </button>
      </section>

      <section className="judgment-card">
        <button className="judgment-toggle" onClick={() => setJudgmentOpen((o) => !o)}>
          <span className="judgment-toggle-label">就業判定(タップで入力)</span>
          <span className="judgment-summary">{judgmentSummary(draft.judgment)}</span>
          <span className="judgment-arrow">{judgmentOpen ? '▲' : '▼'}</span>
        </button>

        {judgmentOpen && (
          <div className="judgment-body">
            <div className="field-row">
              <label className="field-label">判定区分</label>
              <div className="chip-row">
                {(Object.keys(WORK_CLASS_LABELS) as WorkClass[]).map((wc) => (
                  <button
                    key={wc}
                    className={`chip ${draft.judgment.workClass === wc ? 'chip-active' : ''}`}
                    onClick={() =>
                      setJudgment({ workClass: draft.judgment.workClass === wc ? null : wc })
                    }
                  >
                    {WORK_CLASS_LABELS[wc]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-row">
              <label className="field-label">措置内容(複数選択可)</label>
              <div className="chip-row">
                {MEASURES.map((m) => (
                  <button
                    key={m.key}
                    className={`chip ${draft.judgment.measures.includes(m.key) ? 'chip-active' : ''}`}
                    onClick={() => toggleMeasure(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {draft.judgment.measures.includes('overtime') && (
                <div className="inline-input-row">
                  <span>時間外労働:</span>
                  <input
                    className="text-input inline-num"
                    type="number"
                    inputMode="numeric"
                    placeholder="45"
                    value={draft.judgment.overtimeLimitH}
                    onChange={(e) => setJudgment({ overtimeLimitH: e.target.value })}
                  />
                  <span>時間/月まで</span>
                </div>
              )}
              {draft.judgment.measures.includes('other') && (
                <input
                  className="text-input"
                  type="text"
                  placeholder="その他の措置内容を入力"
                  value={draft.judgment.measureOther}
                  onChange={(e) => setJudgment({ measureOther: e.target.value })}
                />
              )}
            </div>

            <div className="field-row">
              <label className="field-label">措置期間</label>
              <div className="chip-row">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p}
                    className={`chip ${draft.judgment.period === p ? 'chip-active' : ''}`}
                    onClick={() => setJudgment({ period: draft.judgment.period === p ? null : p })}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className={`chip ${draft.judgment.period === 'custom' ? 'chip-active' : ''}`}
                  onClick={() =>
                    setJudgment({ period: draft.judgment.period === 'custom' ? null : 'custom' })
                  }
                >
                  自由入力
                </button>
              </div>
              {draft.judgment.period === 'custom' && (
                <input
                  className="text-input"
                  type="text"
                  placeholder="例: 2週間、次回健診まで"
                  value={draft.judgment.periodCustom}
                  onChange={(e) => setJudgment({ periodCustom: e.target.value })}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {(checkResult || checkError) && (
        <div className="check-panel" ref={checkPanelRef}>
          <div className="check-panel-head">
            <span className="check-panel-title">聞き漏らしチェック</span>
            <button
              className="segment-delete"
              onClick={() => {
                setCheckResult(null)
                setCheckError(null)
              }}
            >
              閉じる
            </button>
          </div>
          {checkError ? (
            <p className="check-panel-error">{checkError}</p>
          ) : (
            <pre className="check-panel-body">{checkResult}</pre>
          )}
        </div>
      )}

      {error && (
        <div className="error-box">
          <p>{error}</p>
          <p className="error-safe">メモはこの端末に保存済みです。失われていません。</p>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            再試行
          </button>
        </div>
      )}

      <div className="generate-bar">
        <div className="generate-row">
          <button
            className="btn btn-check"
            onClick={runCheck}
            disabled={!hasContent || checking || generating}
          >
            {checking ? '確認中…' : '聞き漏らしチェック'}
          </button>
          <button
            className="btn btn-generate"
            onClick={generate}
            disabled={!hasContent || generating || checking}
          >
            {generating ? '生成中…' : '文書を生成'}
          </button>
        </div>
      </div>
    </div>
  )
}
