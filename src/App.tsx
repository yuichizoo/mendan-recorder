import { useCallback, useEffect, useRef, useState } from 'react'
import type { HistoryRecord, Mode } from './types'
import { newId } from './types'
import Onboarding from './components/Onboarding'
import RecordScreen from './screens/RecordScreen'
import HomonRecordScreen from './screens/HomonRecordScreen'
import ResultScreen from './screens/ResultScreen'
import HistoryScreen from './screens/HistoryScreen'
import SettingsScreen from './screens/SettingsScreen'
import { addHistory, listHistory, listQueue, deleteQueue } from './lib/db'
import { getLastBackupAt, isBackupOverdue } from './lib/backup'
import { generateText, splitDocAndCheck } from './lib/api'
import { buildSangyoiSystem } from './lib/prompts/sangyoi'
import { buildHomonSystem } from './lib/prompts/homon'

type Screen = 'record' | 'result' | 'history' | 'settings'

const DRAFT_KEYS: Record<Mode, string> = {
  sangyoi: 'mr_draft_sangyoi',
  homon: 'mr_draft_homon',
}

export default function App() {
  const [mode, setMode] = useState<Mode>('sangyoi')
  const [screen, setScreen] = useState<Screen>('record')
  const [result, setResult] = useState<HistoryRecord | null>(null)
  const [recordKey, setRecordKey] = useState(0)
  const [queueCount, setQueueCount] = useState(0)
  const [queueBusy, setQueueBusy] = useState(false)
  const [queueMsg, setQueueMsg] = useState<string | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(getLastBackupAt)
  const [hasHistory, setHasHistory] = useState(false)
  const processingRef = useRef(false)

  const refreshBackupStatus = useCallback(async () => {
    setLastBackupAt(getLastBackupAt())
    try {
      setHasHistory((await listHistory()).length > 0)
    } catch {
      // IndexedDB不可の環境では未表示のまま
    }
  }, [])

  const refreshQueueCount = useCallback(async () => {
    try {
      setQueueCount((await listQueue()).length)
    } catch {
      // IndexedDB不可の環境では0のまま
    }
  }, [])

  const processQueue = useCallback(
    async (auto: boolean) => {
      if (processingRef.current) return
      processingRef.current = true
      setQueueBusy(true)
      try {
        const items = await listQueue()
        let done = 0
        try {
          for (const item of items) {
            const system =
              item.mode === 'homon'
                ? buildHomonSystem()
                : buildSangyoiSystem(item.interviewType ?? 'other')
            const raw = await generateText({
              system,
              user: item.userText,
              maxTokens: item.mode === 'homon' ? 8192 : 4096,
            })
            const { docText, checkText } = splitDocAndCheck(raw)
            await addHistory({
              id: newId(),
              userText: item.userText,
              mode: item.mode,
              interviewType: item.interviewType,
              caseId: item.caseId,
              docText,
              checkText,
              generatedAt: Date.now(),
              durationSec: item.durationSec,
            })
            await deleteQueue(item.id)
            done++
          }
          if (done > 0) {
            setQueueMsg(`✓ 送信待ち${done}件の生成が完了しました。履歴からご確認ください。`)
            setTimeout(() => setQueueMsg(null), 8000)
          }
        } catch {
          // 失敗した項目はキューに残る(次のオンライン復帰・手動再試行で再挑戦)
          if (!auto) {
            setQueueMsg('再試行に失敗しました。電波状況を確認してください。')
            setTimeout(() => setQueueMsg(null), 6000)
          }
        }
      } finally {
        processingRef.current = false
        setQueueBusy(false)
        void refreshQueueCount()
      }
    },
    [refreshQueueCount],
  )

  useEffect(() => {
    void refreshQueueCount().then(() => {
      if (navigator.onLine) void processQueue(true)
    })
    void refreshBackupStatus()
    const onOnline = () => void processQueue(true)
    const onChanged = () => void refreshQueueCount()
    const onBackupChanged = () => void refreshBackupStatus()
    window.addEventListener('online', onOnline)
    window.addEventListener('mr-queue-changed', onChanged)
    window.addEventListener('mr-backup-changed', onBackupChanged)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('mr-queue-changed', onChanged)
      window.removeEventListener('mr-backup-changed', onBackupChanged)
    }
  }, [processQueue, refreshQueueCount, refreshBackupStatus])

  function handleGenerated(r: HistoryRecord) {
    setResult(r)
    // 履歴への保存失敗(プライベートブラウズ等)でも結果表示は続行する
    void addHistory(r)
      .catch(() => {})
      .then(() => refreshBackupStatus())
    setScreen('result')
  }

  function handleNewInterview() {
    const targetMode = result?.mode ?? mode
    localStorage.removeItem(DRAFT_KEYS[targetMode])
    setMode(targetMode)
    setRecordKey((k) => k + 1)
    setScreen('record')
  }

  async function regenerate() {
    if (!result) return
    const system =
      result.mode === 'homon'
        ? buildHomonSystem()
        : buildSangyoiSystem(result.interviewType ?? 'other')
    const raw = await generateText({
      system,
      user: result.userText,
      maxTokens: result.mode === 'homon' ? 8192 : 4096,
    })
    const { docText, checkText } = splitDocAndCheck(raw)
    const rec: HistoryRecord = {
      ...result,
      id: newId(),
      docText,
      checkText,
      generatedAt: Date.now(),
    }
    setResult(rec)
    void addHistory(rec).catch(() => {})
  }

  return (
    <div className="app" data-mode={mode}>
      <Onboarding />
      <header className="app-header">
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'sangyoi' ? 'mode-tab-active' : ''}`}
            onClick={() => {
              setMode('sangyoi')
              setScreen('record')
            }}
          >
            産業医面談
          </button>
          <button
            className={`mode-tab ${mode === 'homon' ? 'mode-tab-active' : ''}`}
            onClick={() => {
              setMode('homon')
              setScreen('record')
            }}
          >
            訪問診療
          </button>
        </div>
      </header>

      {isBackupOverdue(lastBackupAt, hasHistory) ? (
        <button className="backup-banner" onClick={() => setScreen('settings')}>
          ⚠ バックアップが
          {lastBackupAt === null ? 'まだ一度もされていません' : '30日以上されていません'}
          。タップして設定からエクスポート
        </button>
      ) : (
        <div className="backup-status">
          {lastBackupAt
            ? `最終バックアップ: ${new Date(lastBackupAt).toLocaleDateString('ja-JP')}`
            : 'バックアップ: 未実施(履歴なし)'}
        </div>
      )}

      {queueCount > 0 && (
        <div className="queue-banner">
          <span>電波不良で送信待ちの下書き: {queueCount}件</span>
          <button className="btn-mini" onClick={() => void processQueue(false)} disabled={queueBusy}>
            {queueBusy ? '再試行中…' : '今すぐ再試行'}
          </button>
        </div>
      )}
      {queueMsg && <div className="queue-msg">{queueMsg}</div>}

      <main className="app-main">
        {screen === 'record' ? (
          mode === 'homon' ? (
            <HomonRecordScreen key={`h${recordKey}`} onGenerated={handleGenerated} />
          ) : (
            <RecordScreen key={`s${recordKey}`} onGenerated={handleGenerated} />
          )
        ) : screen === 'result' && result ? (
          <ResultScreen
            result={result}
            onBack={() => {
              setMode(result.mode)
              setScreen('record')
            }}
            onNewInterview={handleNewInterview}
            onRegenerate={regenerate}
          />
        ) : screen === 'history' ? (
          <HistoryScreen
            onOpen={(r) => {
              setResult(r)
              setScreen('result')
            }}
          />
        ) : (
          <SettingsScreen />
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${screen === 'record' || screen === 'result' ? 'nav-active' : ''}`}
          onClick={() => setScreen('record')}
        >
          記録
        </button>
        <button
          className={`nav-item ${screen === 'history' ? 'nav-active' : ''}`}
          onClick={() => setScreen('history')}
        >
          履歴
        </button>
        <button
          className={`nav-item ${screen === 'settings' ? 'nav-active' : ''}`}
          onClick={() => setScreen('settings')}
        >
          設定
        </button>
      </nav>
    </div>
  )
}
