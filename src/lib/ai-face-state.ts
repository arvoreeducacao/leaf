export const faceStates = [
  'resting',
  'alert',
  'listening',
  'thinking',
  'answering',
  'done',
  'error',
  'poked',
] as const

export type FaceState = (typeof faceStates)[number]

export type AskStatus =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'done'
  | 'empty'
  | 'error'

export const faceMiniMaxSize = 20

export const faceTransientStates = ['done', 'error', 'poked'] as const

type FaceInput = Readonly<{
  open: boolean
  typing: boolean
  status: AskStatus
}>

export function faceStateFor({ open, typing, status }: FaceInput): FaceState {
  if (status === 'thinking') {
    return 'thinking'
  }

  if (status === 'writing') {
    return 'answering'
  }

  if (status === 'empty' || status === 'error') {
    return 'error'
  }

  if (status === 'done') {
    return 'done'
  }

  if (typing) {
    return 'listening'
  }

  return open ? 'alert' : 'resting'
}

export function isMiniFace(size: number): boolean {
  return size <= faceMiniMaxSize
}

export function faceHoldMs(state: FaceState): number | null {
  if (state === 'poked') {
    return 620
  }

  if (state === 'done') {
    return 900
  }

  if (state === 'error') {
    return 1600
  }

  return null
}
