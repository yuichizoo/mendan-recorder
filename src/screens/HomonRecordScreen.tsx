import { useEffect, useRef, useState } from 'react'
import type { HistoryRecord, HomonDraft, HomonTagSet, Segment } from '../types'
import { newId } from '../types'
import { useTimer, formatTimer } from '../hooks/useTimer'
import { useWakeLock } from '../hooks/useWakeLock'
import SegmentList from '../components/SegmentList'
import SendPreview from '../components/SendPreview'
import { generateText, splitDocAndCheck, ApiError, MODEL_CHECK } from '../lib/api'
import { addQueue } from '../lib/db'
import {
  buildHomonSystem,
  buildHomonUser,
  buildHomonCheckSystem,
  buildHomonCheckUser,
} from '../lib/prompts/homon'

const DRAFT_KEY = 'mr_draft_homon'

const QUICK_TAGS: Record<HomonTagSet, string[]> = {
  general: [
    '心音',
    '肺音',
    '腹部',
    '浮腫',
    '皮膚',
    '疼痛',
    '食事',
    '排便',
    '睡眠',
    '家族の話',
    '処方変更',
    '次回予定',
  ],
  palliative: [
    '疼痛・NRS',
    'レスキュー回数',
    'オピオイド',
    '貼付剤',
    '点滴・皮下注',
    '悪心嘔吐',
    '呼吸苦',
    'せん妄',
    '食事',
    '排便',
    '家族の話',
    '次回予定',
  ],
}

const TAG_SET_LABELS: Record<HomonTagSet, string> = {
  general: '一般',
  palliative: '緩和ケア',
}

function loadDraft(): HomonDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HomonDraft>
      return {
        patientId: parsed.patientId ?? '',
        prevKarte: parsed.prevKarte ?? '',
        segments: parsed.segments ?? [],
        elapsedSec: parsed.elapsedSec ?? 0,
        tagSet: parsed.tagSet ?? 'general',
      }
    }
  } catch {
    // 壊れたデータは捨てて新規開始
  }
  return { patientId: '', prevKarte: '', segments: [], elapsedSec: 0, tagSet: 'general' }
}

interface Props {
  onGenerated: (result: HistoryRecord) => void
}

export default function HomonRecordScreen({ onGenerated }: Props) {
  const [draft, setDraft] = useState<HomonDraft>(loadDraft)
  const timer = useTimer(draft.elapsedSec)
  useWakeLock(timer.running)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<{ msg: string; queued: boolean } | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const lastUserRef = useRef<string | null>(null)
  const checkPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, elapsedSec: timer.elapsedSec }))
  }, [draft, timer.elapsedSec])

  const tags = QUICK_TAGS[draft.tagSet]
  const usedTags = new Set(
    tags.filter((tag) => draft.segments.some((s) => s.text.includes(`【${tag}】`))),
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
    if (!window.confirm('前回カルテ・当日メモ・タイマーをすべてクリアします。よろしいですか?'))
      return
    timer.reset()
    setDraft({ patientId: '', prevKarte: '', segments: [], elapsedSec: 0, tagSet: draft.tagSet })
    setError(null)
    setCheckResult(null)
    setCheckError(null)
  }

  const hasContent = draft.segments.some((s) => s.text.trim())

  async function runCheck() {
    setChecking(true)
    setCheckError(null)
    try {
      const text = await generateText({
        model: MODEL_CHECK,
        maxTokens: 300,
        system: buildHomonCheckSystem(draft.tagSet === 'palliative'),
        user: buildHomonCheckUser(draft.segments),
      })
      setCheckResult(text.trim())
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '予期しないエラーが発生しました。'
      setCheckError(msg)
      setCheckResult(null)
    } finally {
      setChecking(false)
      setTimeout(
        () => checkPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        50,
      )
    }
  }

  function openPreview() {
    timer.pause()
    setError(null)
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    setPreviewText(
      buildHomonUser({
        patientId: draft.patientId,
        dateStr,
        prevKarte: draft.prevKarte,
        segments: draft.segments,
      }),
    )
  }

  async function generate(userText: string) {
    lastUserRef.current = userText
    setGenerating(true)
    setError(null)
    try {
      const raw = await generateText({
        maxTokens: 8192,
        system: buildHomonSystem(),
        user: userText,
      })
      const { docText, checkText } = splitDocAndCheck(raw)
      onGenerated({
        id: newId(),
        userText,
        mode: 'homon',
        caseId: draft.patientId,
        docText,
        checkText,
        generatedAt: Date.now(),
        durationSec: timer.elapsedSec,
      })
    } catch (e) {
      if (e instanceof ApiError && e.retryable) {
        // 電波・API障害: 下書きを送信待ちキューへ退避
        const queued = await addQueue({
          id: newId(),
          createdAt: Date.now(),
          mode: 'homon',
          caseId: draft.patientId,
          durationSec: timer.elapsedSec,
          userText,
        })
          .then(() => true)
          .catch(() => false)
        if (queued) window.dispatchEvent(new Event('mr-queue-changed'))
        setError({ msg: e.message, queued })
      } else {
        setError({
          msg: e instanceof ApiError ? e.message : '予期しないエラーが発生しました。',
          queued: false,
        })
      }
    } finally {
      setGenerating(false)
      setPreviewText(null)
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
            {timer.elapsedSec > 0 ? '再開' : '訪問開始'}
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
        <label className="field-label" htmlFor="patient-id">
          患者ID(氏名は入力しない)
        </label>
        <input
          id="patient-id"
          className="text-input"
          type="text"
          placeholder="例: P-108、S.Y.様"
          value={draft.patientId}
          onChange={(e) => setDraft((d) => ({ ...d, patientId: e.target.value }))}
        />
      </section>

      <section className="field-row">
        <label className="field-label" htmlFor="prev-karte">
          前回カルテ貼り付け(ヘッダー+SOAP全文)
        </label>
        <textarea
          id="prev-karte"
          className="paste-area"
          placeholder="モバカルネットから前回カルテをコピーしてここに貼り付け"
          value={draft.prevKarte}
          onChange={(e) => setDraft((d) => ({ ...d, prevKarte: e.target.value }))}
        />
        {draft.prevKarte.trim() && (
          <p className="field-hint">{draft.prevKarte.trim().length}文字 貼り付け済み</p>
        )}
      </section>

      <section className="field-row">
        <div className="tag-head-row">
          <label className="field-label">クイックタグ(タップで当日メモに挿入)</label>
          <div className="tagset-switch">
            {(Object.keys(TAG_SET_LABELS) as HomonTagSet[]).map((ts) => (
              <button
                key={ts}
                className={`tagset-btn ${draft.tagSet === ts ? 'tagset-active' : ''}`}
                onClick={() => setDraft((d) => ({ ...d, tagSet: ts }))}
              >
                {TAG_SET_LABELS[ts]}
              </button>
            ))}
          </div>
        </div>
        <div className="chip-row">
          {tags.map((tag) => (
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

      <SegmentList
        segments={draft.segments}
        focusId={focusId}
        onFocusDone={() => setFocusId(null)}
        onUpdate={updateSegment}
        onDelete={deleteSegment}
        onAdd={() => addSegment()}
        emptyHint={
          <>
            診察直後に「+ メモ追加」→音声入力。
            <br />
            所見・変更点・次回予定の3点があると空欄がほぼ出ません。
          </>
        }
      />

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
          <p>{error.msg}</p>
          {error.queued ? (
            <p className="error-safe">
              下書きを「送信待ち」に保存しました。電波が戻ると自動で生成され、履歴に保存されます
              (画面上部の「今すぐ再試行」も使えます)。
            </p>
          ) : (
            <>
              <p className="error-safe">メモはこの端末に保存済みです。失われていません。</p>
              <button
                className="btn btn-primary"
                onClick={() =>
                  lastUserRef.current ? generate(lastUserRef.current) : openPreview()
                }
                disabled={generating}
              >
                再試行
              </button>
            </>
          )}
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
            onClick={openPreview}
            disabled={!hasContent || generating || checking}
          >
            {generating ? '生成中…' : 'カルテを生成'}
          </button>
        </div>
      </div>

      {previewText !== null && (
        <SendPreview
          userText={previewText}
          sendLabel="この内容でカルテ生成"
          sending={generating}
          onCancel={() => setPreviewText(null)}
          onSend={generate}
        />
      )}
    </div>
  )
}
