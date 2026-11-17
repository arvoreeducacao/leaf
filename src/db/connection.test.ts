import { describe, expect, it } from 'vitest'

import { connectionOptions } from './connection'

const URL_WITH_PASSWORD = 'mysql://leaf:s3cret@db.example.com:3306/leaf'
const URL_WITHOUT_PASSWORD = 'mysql://leaf_app@db.example.com:3306/leaf'

describe('connectionOptions', () => {
  it('uses the password from the URL by default', () => {
    const options = connectionOptions(URL_WITH_PASSWORD, {})

    expect(options.password).toBe('s3cret')
    expect(options.authPlugins).toBeUndefined()
    expect(options.ssl).toBeUndefined()
  })

  it('signs a fresh IAM token for every new connection over verified TLS', async () => {
    const targets: Array<unknown> = []
    let issued = 0

    const options = connectionOptions(
      URL_WITHOUT_PASSWORD,
      { DATABASE_IAM_AUTH: 'true', DATABASE_IAM_REGION: 'us-east-1' },
      async (target) => {
        targets.push(target)
        issued += 1

        return `token-${issued}`
      },
    )

    expect(options.password).toBeUndefined()
    expect(options.user).toBe('leaf_app')
    expect(options.database).toBe('leaf')
    expect(options.ssl).toMatchObject({ rejectUnauthorized: true })

    const plugin = options.authPlugins?.mysql_clear_password

    expect(plugin).toBeDefined()

    const answer = plugin!({
      connection: null as never,
      command: null as never,
    })

    expect(String(await answer(Buffer.alloc(0)))).toBe('token-1\0')
    expect(String(await answer(Buffer.alloc(0)))).toBe('token-2\0')
    expect(targets[0]).toEqual({
      host: 'db.example.com',
      port: 3306,
      user: 'leaf_app',
      region: 'us-east-1',
    })
  })

  it('ignores a password left in the URL once IAM is on', () => {
    const options = connectionOptions(URL_WITH_PASSWORD, {
      DATABASE_IAM_AUTH: 'true',
      AWS_REGION: 'us-east-1',
    })

    expect(options.password).toBeUndefined()
    expect(options.authPlugins?.mysql_clear_password).toBeDefined()
  })

  it('refuses IAM without a region to sign with', () => {
    expect(() =>
      connectionOptions(URL_WITHOUT_PASSWORD, { DATABASE_IAM_AUTH: 'true' }),
    ).toThrow(/DATABASE_IAM_REGION/)
  })
})
