import { useRef, useState } from 'react'
import type { CompanyEntry } from '../lib/anonymize'
import { getApiKey, setApiKey, getCompanies, saveCompanies, clearAllData } from '../lib/settings'
import { clearHistoryDb, clearQueueDb } from '../lib/db'
import { exportBackup, importBackup, getLastBackupAt } from '../lib/backup'

export default function SettingsScreen() {
  const [key, setKey] = useState(getApiKey)
  const [saved, setSaved] = useState(false)
  const [companies, setCompanies] = useState<CompanyEntry[]>(getCompanies)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [lastBackup, setLastBackup] = useState<number | null>(getLastBackupAt)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function doExport() {
    setBackupBusy(true)
    setBackupMsg(null)
    try {
      const outcome = await exportBackup()
      if (outcome === 'empty') {
        setBackupMsg('履歴がまだないため、エクスポートするものがありません。')
      } else if (outcome === 'cancelled') {
        setBackupMsg('エクスポートをキャンセルしました。')
      } else {
        setLastBackup(getLastBackupAt())
        setBackupMsg(
          outcome === 'shared'
            ? '✓ 共有シートからバックアップを保存しました。'
            : '✓ バックアップファイルをダウンロードしました。',
        )
      }
    } catch {
      setBackupMsg('エクスポートに失敗しました。')
    } finally {
      setBackupBusy(false)
    }
  }

  async function doImport(file: File) {
    setBackupBusy(true)
    setBackupMsg(null)
    try {
      const text = await file.text()
      const { added, skipped } = await importBackup(text)
      setBackupMsg(`✓ インポート完了: ${added}件追加、${skipped}件スキップ(重複・不正データ)。`)
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : 'インポートに失敗しました。')
    } finally {
      setBackupBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function save() {
    setApiKey(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateCompanies(next: CompanyEntry[]) {
    setCompanies(next)
    saveCompanies(next)
  }

  function addCompany() {
    updateCompanies([
      ...companies,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '', variants: '' },
    ])
  }

  function patchCompany(id: string, patch: Partial<CompanyEntry>) {
    updateCompanies(companies.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeCompany(id: string) {
    updateCompanies(companies.filter((c) => c.id !== id))
  }

  async function deleteAll() {
    if (
      !window.confirm(
        'APIキー・企業名辞書・メモの下書き・履歴など、このアプリのデータをすべて削除します。よろしいですか?',
      )
    )
      return
    clearAllData()
    await clearHistoryDb().catch(() => {})
    await clearQueueDb().catch(() => {})
    setKey('')
    setCompanies([])
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

      <section className="field-row">
        <label className="field-label">クライアント企業名辞書</label>
        <p className="field-hint">
          登録した企業名は送信前プレビューで自動検出され、タップで「A社」等に置換できます。
          音声入力の誤変換も拾えるよう、読み方のバリエーションも登録できます(カンマ区切り)。
        </p>
        {companies.map((c) => (
          <div key={c.id} className="company-card">
            <div className="company-head">
              <input
                className="text-input company-name"
                type="text"
                placeholder="企業名(例: 山田運送株式会社)"
                value={c.name}
                onChange={(e) => patchCompany(c.id, { name: e.target.value })}
              />
              <button className="segment-delete" onClick={() => removeCompany(c.id)}>
                削除
              </button>
            </div>
            <input
              className="text-input"
              type="text"
              placeholder="バリエーション(例: 山田運送, ヤマダ運送, やまだ)"
              value={c.variants}
              onChange={(e) => patchCompany(c.id, { variants: e.target.value })}
            />
          </div>
        ))}
        <button className="btn btn-outline" onClick={addCompany}>
          + 企業を追加
        </button>
      </section>

      <section className="field-row">
        <label className="field-label">バックアップ(履歴のエクスポート/インポート)</label>
        <p className="field-hint">
          履歴はこの端末内にのみ保存されるため、機種変更や誤削除に備えて定期的にエクスポートしてください。
          {lastBackup
            ? ` 最終バックアップ: ${new Date(lastBackup).toLocaleDateString('ja-JP')}`
            : ' まだバックアップしていません。'}
        </p>
        <button className="btn btn-primary" onClick={doExport} disabled={backupBusy}>
          {backupBusy ? '処理中…' : '全履歴をエクスポート'}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={backupBusy}
        >
          バックアップから復元(インポート)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
          }}
        />
        <p className="field-hint">
          インポートは既存の履歴に追加(マージ)され、同じ記録は自動でスキップされます。
        </p>
        {backupMsg && <p className="backup-msg">{backupMsg}</p>}
      </section>

      <section className="field-row danger-zone">
        <label className="field-label">データの全削除</label>
        <p className="field-hint">
          APIキー・企業名辞書・メモ下書き・生成結果をこの端末から完全に削除します。
        </p>
        <button className="btn btn-danger" onClick={deleteAll}>
          すべてのデータを削除
        </button>
      </section>
    </div>
  )
}
