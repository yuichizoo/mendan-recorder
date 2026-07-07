import { useState } from 'react'
import type { GenerateResult, Mode } from './types'
import RecordScreen from './screens/RecordScreen'
import HomonRecordScreen from './screens/HomonRecordScreen'
import ResultScreen from './screens/ResultScreen'
import SettingsScreen from './screens/SettingsScreen'

type Screen = 'record' | 'result' | 'history' | 'settings'

const RESULT_KEY = 'mr_last_result'
const DRAFT_KEYS: Record<Mode, string> = {
  sangyoi: 'mr_draft_sangyoi',
  homon: 'mr_draft_homon',
}

function loadLastResult(): GenerateResult | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    return raw ? (JSON.parse(raw) as GenerateResult) : null
  } catch {
    return null
  }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('sangyoi')
  const [screen, setScreen] = useState<Screen>('record')
  const [result, setResult] = useState<GenerateResult | null>(loadLastResult)
  const [recordKey, setRecordKey] = useState(0)

  function handleGenerated(r: GenerateResult) {
    setResult(r)
    localStorage.setItem(RESULT_KEY, JSON.stringify(r))
    setScreen('result')
  }

  function handleNewInterview() {
    const targetMode = result?.mode ?? mode
    localStorage.removeItem(DRAFT_KEYS[targetMode])
    setRecordKey((k) => k + 1)
    setScreen('record')
  }

  return (
    <div className="app" data-mode={mode}>
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
            onBack={() => setScreen('record')}
            onNewInterview={handleNewInterview}
          />
        ) : screen === 'history' ? (
          <div className="screen">
            <p className="empty-hint">履歴は実装順⑥で追加予定です。</p>
            {result && (
              <button className="btn btn-outline" onClick={() => setScreen('result')}>
                最後に生成した文書を表示
              </button>
            )}
          </div>
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
