import { expect, test } from '@playwright/test'

import { continueWithEmail, password } from './helpers'

let counter = 0

function allowedEmail(prefix: string) {
  counter += 1

  return `${prefix}-${Date.now()}-${process.pid}-${counter}@example.com`
}

test.describe('domain restriction', () => {
  test('only the allowed domain signs in and only it can be invited', async ({
    page,
  }) => {
    await page.goto('/signup')

    await expect(page.getByText('Use seu email @example.com')).toBeVisible()

    await continueWithEmail(page, 'person@gmail.com')
    await page.getByLabel('Senha').fill(password)
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(
      page.getByText('Use seu email @example.com para entrar no Leaf.'),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/signup$/)

    const email = allowedEmail('owner')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Senha').fill(password)
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await page.waitForURL((url) => !/\/(signup|login)$/.test(url.pathname))

    await page.goto('/org')
    await page.getByLabel('Nome da organização').fill('Restricted School')
    await page.getByRole('button', { name: 'Criar organização' }).click()
    await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible()

    await page.getByLabel('Email', { exact: true }).fill('external@gmail.com')
    await page.getByRole('button', { name: 'Convidar', exact: true }).click()

    await expect(
      page.getByText('Somente contas @example.com.').first(),
    ).toBeVisible()

    const invited = allowedEmail('guest')

    await page.getByLabel('Email', { exact: true }).fill(invited)
    await page.getByRole('button', { name: 'Convidar', exact: true }).click()

    await expect(page.getByText(invited).first()).toBeVisible()
  })
})
