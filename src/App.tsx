import { useState } from 'react'
import type { HistoryRecord, Mode } from './types'
import { newId } from './types'
import Onboarding from './components/Onboarding'
import RecordScreen from './screens/RecordScreen'
import HomonRecordScreen from './screens/HomonRecordScreen'
import ResultScreen from './screens/ResultScreen'
import HistoryScreen from './screens/HistoryScreen'
import SettingsScreen from './screens/SettingsScreen'
import { addHistory } from './lib/db'
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

  function handleGenerated(r: HistoryRecord) {
    setResult(r)
    // 履歴への保存失敗(プライベートブラウズ等)でも結果表示は続行する
    void addHistory(r).catch(() => {})
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
