import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadComments = vi.hoisted(() => vi.fn())

vi.mock('@/lib/comment-actions', () => ({ loadComments }))
vi.mock('sonner', () => ({ toast: { error: () => undefined } }))

import { ensureCommentsLoaded, reloadComments } from './comments-store'

type Answer = (value: unknown) => void

let answers: Array<Answer> = []

function answer(index: number, threads: Array<string>) {
  answers[index]({ ok: true, state: { threads } })
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  answers = []
  loadComments.mockReset()
  loadComments.mockImplementation(
    () => new Promise((resolve) => answers.push(resolve)),
  )
})

describe('reloading comments when another tab changes them', () => {
  it('loads again after the first load when the signal came during it', async () => {
    const first = ensureCommentsLoaded('doc-first')

    await reloadComments('doc-first')
    answer(0, [])
    await first
    await settle()

    expect(loadComments).toHaveBeenCalledTimes(2)
  })

  it('folds several signals during one reload into a single extra load', async () => {
    const first = reloadComments('doc-burst')

    await reloadComments('doc-burst')
    await reloadComments('doc-burst')
    answer(0, [])
    await first
    await settle()
    answer(1, [])
    await settle()

    expect(loadComments).toHaveBeenCalledTimes(2)
  })
})
