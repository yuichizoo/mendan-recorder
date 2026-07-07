import type { HistoryRecord } from '../types'
import { listHistory, addHistory } from './db'

// 履歴のJSONバックアップ(エクスポート/インポート)。
// エクスポートはWeb Share API優先、非対応環境はファイルダウンロードにフォールバック。

const KEY_LAST_BACKUP = 'mr_last_backup'
export const BACKUP_REMIND_DAYS = 30

export function getLastBackupAt(): number | null {
  const raw = localStorage.getItem(KEY_LAST_BACKUP)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : null
}

function setLastBackupAt(ts: number) {
  localStorage.setItem(KEY_LAST_BACKUP, String(ts))
  window.dispatchEvent(new Event('mr-backup-changed'))
}

export function isBackupOverdue(lastBackupAt: number | null, hasHistory: boolean): boolean {
  if (!hasHistory) return false
  if (lastBackupAt === null) return true
  return Date.now() - lastBackupAt > BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000
}

function backupFileName(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `mendan-backup_${ymd}.json`
}

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled' | 'empty'

export async function exportBackup(): Promise<ExportOutcome> {
  const records = await listHistory()
  if (records.length === 0) return 'empty'

  const json = JSON.stringify(
    { app: 'mendan-recorder', version: 1, exportedAt: new Date().toISOString(), records },
    null,
    2,
  )
  const name = backupFileName()
  const file = new File([json], name, { type: 'application/json' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '面談レコーダー バックアップ' })
      setLastBackupAt(Date.now())
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // 共有失敗時はダウンロードにフォールバック
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  setLastBackupAt(Date.now())
  return 'downloaded'
}

export interface ImportResult {
  added: number
  skipped: number
}

export async function importBackup(fileText: string): Promise<ImportResult> {
  let data: unknown
  try {
    data = JSON.parse(fileText)
  } catch {
    throw new Error('JSONとして読み込めませんでした。バックアップファイルか確認してください。')
  }

  const records = Array.isArray(data)
    ? data
    : (data as { records?: unknown })?.records
  if (!Array.isArray(records)) {
    throw new Error('バックアップ形式が違います(recordsが見つかりません)。')
  }

  // 既存履歴とマージ: ID、およびタイムスタンプ+モード+対象者IDで重複排除
  const existing = await listHistory()
  const ids = new Set(existing.map((r) => r.id))
  const stamps = new Set(existing.map((r) => `${r.generatedAt}|${r.mode}|${r.caseId}`))

  let added = 0
  let skipped = 0
  for (const raw of records) {
    const r = raw as Partial<HistoryRecord>
    const valid =
      r &&
      typeof r.id === 'string' &&
      typeof r.docText === 'string' &&
      typeof r.generatedAt === 'number' &&
      (r.mode === 'sangyoi' || r.mode === 'homon')
    if (!valid) {
      skipped++
      continue
    }
    const stamp = `${r.generatedAt}|${r.mode}|${r.caseId ?? ''}`
    if (ids.has(r.id!) || stamps.has(stamp)) {
      skipped++
      continue
    }
    await addHistory({
      id: r.id!,
      userText: r.userText ?? '',
      mode: r.mode!,
      interviewType: r.interviewType,
      caseId: r.caseId ?? '',
      docText: r.docText!,
      checkText: r.checkText ?? '',
      generatedAt: r.generatedAt!,
      durationSec: r.durationSec ?? 0,
    })
    ids.add(r.id!)
    stamps.add(stamp)
    added++
  }
  return { added, skipped }
}
