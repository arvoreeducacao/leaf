'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type FavoritesValue = Readonly<{
  isFavorite: (documentId: string) => boolean
  setFavorite: (documentId: string, favorite: boolean) => void
}>

const FavoritesContext = createContext<FavoritesValue>({
  isFavorite: () => false,
  setFavorite: () => {},
})

export function FavoritesProvider({
  ids,
  children,
}: Readonly<{ ids: ReadonlyArray<string>; children: React.ReactNode }>) {
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(new Map())
  const key = ids.join(',')

  useEffect(() => {
    setPending((current) => (current.size === 0 ? current : new Map()))
  }, [key])

  const stored = new Set(ids)
  const value: FavoritesValue = {
    isFavorite: (documentId) =>
      pending.get(documentId) ?? stored.has(documentId),
    setFavorite: (documentId, favorite) =>
      setPending((current) => new Map(current).set(documentId, favorite)),
  }

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
