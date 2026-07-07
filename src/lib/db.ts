import type { HistoryRecord, QueueItem } from '../types'

// 履歴・送信待ちキューのIndexedDB保存。サーバーには一切送らず、この端末内にのみ保存する。
const DB_NAME = 'mendan-recorder'
const STORE_HISTORY = 'history'
const STORE_QUEUE = 'queue'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const store = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' })
        store.createIndex('generatedAt', 'generatedAt')
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    const req = fn(t.objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

// --- 履歴 ---

export async function addHistory(rec: HistoryRecord): Promise<void> {
  await withStore(STORE_HISTORY, 'readwrite', (s) => s.put(rec))
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const all = await withStore<HistoryRecord[]>(STORE_HISTORY, 'readonly', (s) => s.getAll())
  return all.sort((a, b) => b.generatedAt - a.generatedAt)
}

export async function deleteHistory(id: string): Promise<void> {
  await withStore(STORE_HISTORY, 'readwrite', (s) => s.delete(id))
}

export async function clearHistoryDb(): Promise<void> {
  await withStore(STORE_HISTORY, 'readwrite', (s) => s.clear())
}

// --- 送信待ちキュー ---

export async function addQueue(item: QueueItem): Promise<void> {
  await withStore(STORE_QUEUE, 'readwrite', (s) => s.put(item))
}

export async function listQueue(): Promise<QueueItem[]> {
  const all = await withStore<QueueItem[]>(STORE_QUEUE, 'readonly', (s) => s.getAll())
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function deleteQueue(id: string): Promise<void> {
  await withStore(STORE_QUEUE, 'readwrite', (s) => s.delete(id))
}

export async function clearQueueDb(): Promise<void> {
  await withStore(STORE_QUEUE, 'readwrite', (s) => s.clear())
}
