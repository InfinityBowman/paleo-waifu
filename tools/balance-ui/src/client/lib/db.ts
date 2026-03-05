import { openDB, type IDBPDatabase } from 'idb'
import type { RunHistoryDB } from '../../shared/types.ts'

let dbPromise: Promise<IDBPDatabase<RunHistoryDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RunHistoryDB>('balance-runs', 1, {
      upgrade(db) {
        const store = db.createObjectStore('runs', { keyPath: 'id' })
        store.createIndex('by-created', 'createdAt')
      },
    })
  }
  return dbPromise
}
