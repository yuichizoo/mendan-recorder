import { useState } from 'react'

const DISMISS_KEY = 'mr_onboard_dismissed'

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export default function Onboarding() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  )

  if (dismissed || isStandalone() || !isIOS()) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="onboard-overlay">
      <div className="onboard-card">
        <h2 className="onboard-title">最初にホーム画面へ追加してください</h2>
        <p className="onboard-text">
          Safariのままだと、<strong>7日間使わなかった場合にメモや履歴などのデータが自動削除</strong>
          されます。ホーム画面に追加したアプリから起動すれば削除されず、全画面で快適に使えます。
        </p>
        <ol className="onboard-steps">
          <li>
            画面下の<strong>共有ボタン(□に↑)</strong>をタップ
          </li>
          <li>
            <strong>「ホーム画面に追加」</strong>を選ぶ
          </li>
          <li>ホーム画面の「面談レコーダー」から起動する</li>
        </ol>
        <button className="btn btn-primary" onClick={dismiss}>
          わかりました
        </button>
        <button className="btn btn-ghost" onClick={dismiss}>
          あとで(このまま使う)
        </button>
      </div>
    </div>
  )
}
