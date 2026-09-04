import { expect, test } from '@playwright/test'

import { createDocument, signUp, uniqueEmail } from './helpers'

test.describe('icon', () => {
  test('picks an emoji from the gallery, changes it and removes it', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('icon'))
    await createDocument(page, 'Page with an icon')

    const iconButton = page.getByTestId('document-icon-button')

    await expect(iconButton).toHaveCount(0)

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar ícone' }).click()

    const picker = page.getByRole('dialog', { name: 'Ícone da página' })

    await expect(picker).toBeVisible()
    await picker.locator('[data-emoji="🚀"]').click()

    await expect(picker).toBeHidden()
    await expect(iconButton).toContainText('🚀')
    await expect(
      page.getByRole('button', { name: 'Adicionar ícone' }),
    ).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('document-icon-button')).toContainText('🚀')

    await page.getByTestId('document-icon-button').click()
    await expect(picker).toBeVisible()
    await picker.locator('[data-emoji="🦉"]').click()

    await expect(picker).toBeHidden()
    await expect(page.getByTestId('document-icon-button')).toContainText('🦉')

    await page.getByTestId('document-icon-button').click()
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText('Ícone removido')).toBeVisible()
    await expect(page.getByTestId('document-icon-button')).toHaveCount(0)
    await page.getByLabel('Título do documento').hover()
    await expect(
      page.getByRole('button', { name: 'Adicionar ícone' }),
    ).toBeVisible()
  })

  test('searches an emoji by name and shows it in the sidebar', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('icon-search'))
    await createDocument(page, 'Searched icon')

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar ícone' }).click()

    const picker = page.getByRole('dialog', { name: 'Ícone da página' })

    await picker.getByLabel('Buscar emoji').fill('coração')
    await expect(picker.locator('[data-emoji="❤️"]')).toBeVisible()
    await picker.locator('[data-emoji="❤️"]').click()

    await expect(picker).toBeHidden()
    await expect(page.getByTestId('document-icon-button')).toContainText('❤️')
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Searched icon' }).first(),
    ).toContainText('❤️')
  })

  test('tells the person when no emoji matches the search', async ({ page }) => {
    await signUp(page, uniqueEmail('icon-empty'))
    await createDocument(page, 'No match')

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar ícone' }).click()

    const picker = page.getByRole('dialog', { name: 'Ícone da página' })

    await picker.getByLabel('Buscar emoji').fill('zzzzzz')
    await expect(picker.getByText('Nenhum emoji para "zzzzzz"')).toBeVisible()
  })

  test('accepts an https link as icon and rejects anything else', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('icon-link'))
    await createDocument(page, 'Linked icon')

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar ícone' }).click()

    const picker = page.getByRole('dialog', { name: 'Ícone da página' })

    await picker.getByRole('tab', { name: 'Link' }).click()
    await picker.getByLabel('Endereço da imagem').fill('http://example.com/a.png')
    await picker.getByRole('button', { name: 'Usar link' }).click()

    await expect(
      picker.getByText('Cole um endereço https:// de uma imagem'),
    ).toBeVisible()

    await picker
      .getByLabel('Endereço da imagem')
      .fill('https://www.notion.so/icons/rocket_blue.svg')
    await picker.getByRole('button', { name: 'Usar link' }).click()

    await expect(picker).toBeHidden()
    await expect(
      page.getByTestId('document-icon-button').getByRole('img', { includeHidden: true }),
    ).toHaveAttribute('src', 'https://www.notion.so/icons/rocket_blue.svg')
  })

  test('keeps the icon and the cover side by side', async ({ page }) => {
    await signUp(page, uniqueEmail('icon-cover'))
    await createDocument(page, 'Icon over cover')

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar capa' }).click()

    await expect(page.getByTestId('document-cover')).toBeVisible()

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar ícone' }).click()

    const picker = page.getByRole('dialog', { name: 'Ícone da página' })

    await expect(picker).toBeVisible()
    await picker.locator('[data-emoji="🚀"]').click()

    await expect(picker).toBeHidden()
    await expect(page.getByTestId('document-icon-button')).toContainText('🚀')
    await expect(page.getByTestId('document-cover')).toBeVisible()
  })
})
