import { expect, test } from '@playwright/test'

import { password } from './helpers'

let counter = 0

function allowedEmail(prefix: string) {
  counter += 1

  return `${prefix}-${Date.now()}-${process.pid}-${counter}@arvore.com.br`
}

test.describe('restrição de domínio', () => {
  test('só a conta da Árvore entra e só ela pode ser convidada', async ({
    page,
  }) => {
    await page.goto('/signup')

    await expect(page.getByText('Use seu email @arvore.com.br')).toBeVisible()

    await page.getByLabel('Email').fill('pessoa@gmail.com')
    await page.getByLabel('Senha').fill(password)
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(
      page.getByText('Use seu email @arvore.com.br para entrar no Leaf.'),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/signup$/)

    const email = allowedEmail('dona')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Senha').fill(password)
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await page.waitForURL((url) => !/\/(signup|login)$/.test(url.pathname))

    await page.goto('/org')
    await page.getByLabel('Nome da organização').fill('Escola Restrita')
    await page.getByRole('button', { name: 'Criar organização' }).click()
    await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible()

    await page.getByLabel('Email', { exact: true }).fill('externa@gmail.com')
    await page.getByRole('button', { name: 'Convidar', exact: true }).click()

    await expect(
      page.getByText('Somente contas @arvore.com.br.').first(),
    ).toBeVisible()

    const invited = allowedEmail('convidada')

    await page.getByLabel('Email', { exact: true }).fill(invited)
    await page.getByRole('button', { name: 'Convidar', exact: true }).click()

    await expect(page.getByText(invited).first()).toBeVisible()
  })
})
