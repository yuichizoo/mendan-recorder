import { useState } from 'react'
import { getApiKey, setApiKey, clearAllData } from '../lib/settings'

export default function SettingsScreen() {
  const [key, setKey] = useState(getApiKey)
  const [saved, setSaved] = useState(false)

  function save() {
    setApiKey(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function deleteAll() {
    if (
      !window.confirm(
        'APIキー・メモの下書き・生成結果など、このアプリのデータをすべて削除します。よろしいですか?',
      )
    )
      return
    clearAllData()
    setKey('')
    window.alert('すべてのデータを削除しました。')
  }

  return (
    <div className="screen">
      <div className="notice-box">
        診療・面談内容は外部API(Anthropic)に送信されます。
        氏名・住所等の個人識別情報は入力しないでください。
      </div>

      <section className="field-row">
        <label className="field-label" htmlFor="api-key">
          Anthropic APIキー
        </label>
        <input
          id="api-key"
          className="text-input"
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />
        <p className="field-hint">この端末のブラウザ内にのみ保存されます(個人利用限定)。</p>
        <button className="btn btn-primary" onClick={save}>
          {saved ? '✓ 保存しました' : '保存'}
        </button>
      </section>

      <section className="field-row danger-zone">
        <label className="field-label">データの全削除</label>
        <p className="field-hint">APIキー・メモ下書き・生成結果をこの端末から完全に削除します。</p>
        <button className="btn btn-danger" onClick={deleteAll}>
          すべてのデータを削除
        </button>
      </section>
    </div>
  )
}
