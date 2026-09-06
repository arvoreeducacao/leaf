import { expect, test } from '@playwright/test'

test.describe('security headers', () => {
  test('a page cannot be framed and asks for https', async ({ request }) => {
    const response = await request.get('/login')

    expect(response.headers()['x-frame-options']).toBe('DENY')
    expect(response.headers()['content-security-policy']).toBe(
      "frame-ancestors 'none'",
    )
    expect(response.headers()['strict-transport-security']).toContain(
      'max-age=',
    )
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    )
    expect(response.headers()['x-powered-by']).toBeUndefined()
  })

  test('an asset route keeps the sandbox policy of its own', async ({
    request,
  }) => {
    const response = await request.get('/api/avatar/leaf')

    expect(response.headers()['content-security-policy']).toContain('sandbox')
    expect(response.headers()['x-frame-options']).toBe('DENY')
  })
})
