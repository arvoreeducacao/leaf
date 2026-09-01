'use client'

const live = new Set<string>()

export function markLive(documentId: string) {
  live.add(documentId)
}

export function unmarkLive(documentId: string) {
  live.delete(documentId)
}

export function isLive(documentId: string) {
  return live.has(documentId)
}
