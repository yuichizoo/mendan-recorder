import type { HistoryRecord } from '../types'

// 履歴のIndexedDB保存。サーバーには一切送らず、この端末内にのみ保存する。
const DB_NAME = 'mendan-recorder'
const STORE = 'history'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('generatedAt', 'generatedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

export async function addHistory(rec: HistoryRecord): Promise<void> {
  await withStore('readwrite', (s) => s.put(rec))
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const all = await withStore<HistoryRecord[]>('readonly', (s) => s.getAll())
  return all.sort((a, b) => b.generatedAt - a.generatedAt)
}

export async function deleteHistory(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

export async function clearHistoryDb(): Promise<void> {
  await withStore('readwrite', (s) => s.clear())
}
