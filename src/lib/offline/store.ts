export type OfflineStore = Readonly<{
  get: <T>(key: string) => Promise<T | null>
  set: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
  keys: () => Promise<Array<string>>
}>

export const offlineDatabaseName = 'leaf-offline'
export const offlineStoreName = 'kv'

export function createMemoryStore(
  seed: Record<string, unknown> = {},
): OfflineStore {
  const entries = new Map<string, unknown>(Object.entries(seed))

  return {
    async get<T>(key: string) {
      return entries.has(key) ? (entries.get(key) as T) : null
    },
    async set(key, value) {
      entries.set(key, value)
    },
    async remove(key) {
      entries.delete(key)
    },
    async keys() {
      return [...entries.keys()]
    },
  }
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result)
    source.onerror = () => reject(source.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(offlineDatabaseName, 1)

    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(offlineStoreName)) {
        open.result.createObjectStore(offlineStoreName)
      }
    }

    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
    open.onblocked = () => reject(new Error('leaf-offline is blocked'))
  })
}

function isAvailable() {
  return typeof indexedDB !== 'undefined'
}

export function createIndexedDbStore(): OfflineStore {
  let connection: Promise<IDBDatabase> | null = null

  function database() {
    if (!connection) {
      connection = openDatabase()
    }

    return connection
  }

  async function transaction<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | null> {
    if (!isAvailable()) {
      return null
    }

    try {
      const db = await database()

      return await request(
        run(db.transaction(offlineStoreName, mode).objectStore(offlineStoreName)),
      )
    } catch {
      connection = null

      return null
    }
  }

  return {
    async get<T>(key: string) {
      const value = await transaction<T>('readonly', (store) =>
        store.get(key) as IDBRequest<T>,
      )

      return value ?? null
    },
    async set(key, value) {
      await transaction('readwrite', (store) => store.put(value, key))
    },
    async remove(key) {
      await transaction('readwrite', (store) => store.delete(key))
    },
    async keys() {
      const keys = await transaction<Array<IDBValidKey>>(
        'readonly',
        (store) => store.getAllKeys(),
      )

      return (keys ?? []).map(String)
    },
  }
}

let shared: OfflineStore | null = null

export function offlineStore(): OfflineStore {
  if (!shared) {
    shared = isAvailable() ? createIndexedDbStore() : createMemoryStore()
  }

  return shared
}
