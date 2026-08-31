'use client'

import { useSyncExternalStore } from 'react'

export type BlockIndex = Readonly<{
  ready: boolean
  ids: ReadonlySet<string>
}>

const emptyIndex: BlockIndex = { ready: false, ids: new Set<string>() }

let index: BlockIndex = emptyIndex

const listeners = new Set<() => void>()

function sameIds(current: ReadonlySet<string>, next: ReadonlyArray<string>) {
  if (current.size !== next.length) {
    return false
  }

  return next.every((id) => current.has(id))
}

export function publishBlockIds(ids: ReadonlyArray<string>) {
  if (index.ready && sameIds(index.ids, ids)) {
    return
  }

  index = { ready: true, ids: new Set(ids) }

  for (const listener of listeners) {
    listener()
  }
}

export function resetBlockIds() {
  index = emptyIndex

  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useBlockIndex(): BlockIndex {
  return useSyncExternalStore(
    subscribe,
    () => index,
    () => emptyIndex,
  )
}

export function isAnchorMissing(blockIndex: BlockIndex, blockId: string | null) {
  if (blockId === null) {
    return false
  }

  return blockIndex.ready && !blockIndex.ids.has(blockId)
}

const commentRequestEvent = 'leaf:comment-request'
const blockFocusEvent = 'leaf:comment-focus-block'

type BlockDetail = Readonly<{ blockId: string }>

function dispatch(name: string, detail: BlockDetail) {
  window.dispatchEvent(new CustomEvent<BlockDetail>(name, { detail }))
}

function listen(name: string, handler: (blockId: string) => void) {
  function onEvent(event: Event) {
    handler((event as CustomEvent<BlockDetail>).detail.blockId)
  }

  window.addEventListener(name, onEvent)

  return () => {
    window.removeEventListener(name, onEvent)
  }
}

export function requestCommentOnBlock(blockId: string) {
  dispatch(commentRequestEvent, { blockId })
}

export function onCommentRequest(handler: (blockId: string) => void) {
  return listen(commentRequestEvent, handler)
}

export function focusCommentedBlock(blockId: string) {
  dispatch(blockFocusEvent, { blockId })
}

export function onCommentedBlockFocus(handler: (blockId: string) => void) {
  return listen(blockFocusEvent, handler)
}
