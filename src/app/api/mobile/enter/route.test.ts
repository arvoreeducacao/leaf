import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyOneTimeToken } = vi.hoisted(() => ({ verifyOneTimeToken: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  auth: { api: { verifyOneTimeToken } },
}))

import { GET } from '@/app/api/mobile/enter/route'

const entryUrl = 'https://leaf.example.com/api/mobile/enter'

function betterCallStyleError(status: number) {
  const error = new Error('token invalid') as Error & { status: string; statusCode: number }
  error.name = 'APIError'
  error.status = 'UNAUTHORIZED'
  error.statusCode = status

  return error
}

describe('GET /api/mobile/enter', () => {
  beforeEach(() => {
    verifyOneTimeToken.mockReset()
  })

  it('answers 400 without a token and never touches the auth api', async () => {
    const response = await GET(new Request(entryUrl))

    expect(response.status).toBe(400)
    expect(verifyOneTimeToken).not.toHaveBeenCalled()
  })

  it('sets the session cookies and redirects to a relative /', async () => {
    const headers = new Headers()
    headers.append('set-cookie', '__Secure-better-auth.session_token=abc; Path=/; HttpOnly; Secure')
    headers.append('set-cookie', '__Secure-better-auth.session_data=def; Path=/; HttpOnly; Secure')
    verifyOneTimeToken.mockResolvedValue({ headers, response: {} })

    const response = await GET(new Request(`${entryUrl}?token=one-time`))

    expect(verifyOneTimeToken).toHaveBeenCalledWith({
      body: { token: 'one-time' },
      headers: expect.any(Headers),
      returnHeaders: true,
    })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/')
    expect(response.headers.getSetCookie()).toHaveLength(2)
    expect(response.headers.getSetCookie()[0]).toContain('session_token=abc')
  })

  it('answers 401 when better-auth rejects the token, even with the base APIError class', async () => {
    verifyOneTimeToken.mockRejectedValue(betterCallStyleError(400))

    const response = await GET(new Request(`${entryUrl}?token=used-or-expired`))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_token' })
  })

  it('lets unexpected errors surface', async () => {
    verifyOneTimeToken.mockRejectedValue(new Error('database down'))

    await expect(GET(new Request(`${entryUrl}?token=x`))).rejects.toThrow('database down')
  })
})
