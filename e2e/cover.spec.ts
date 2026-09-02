import { expect, test } from '@playwright/test'

import { createDocument, signUp, uniqueEmail } from './helpers'

test.describe('cover', () => {
  test('adds a random cover, changes it in the gallery and removes it', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('cover'))
    await createDocument(page, 'Page with a cover')

    const cover = page.getByTestId('document-cover')

    await expect(cover).toHaveCount(0)

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar capa' }).click()

    await expect(cover).toBeVisible()
    await expect(cover).toHaveAttribute('data-cover', /^gradient:/)
    await expect(
      page.getByRole('button', { name: 'Adicionar capa' }),
    ).toHaveCount(0)

    await cover.hover()
    await page.getByRole('button', { name: 'Alterar capa' }).click()

    const picker = page.getByRole('dialog', { name: 'Capa da página' })

    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: 'Azul', exact: true }).click()

    await expect(picker).toBeHidden()
    await expect(cover).toHaveAttribute('data-cover', 'gradient:blue')

    await page.reload()
    await expect(page.getByTestId('document-cover')).toHaveAttribute(
      'data-cover',
      'gradient:blue',
    )

    await page.getByTestId('document-cover').hover()
    await page.getByRole('button', { name: 'Alterar capa' }).click()
    await page
      .getByRole('dialog', { name: 'Capa da página' })
      .getByRole('button', { name: 'Remover' })
      .click()

    await expect(page.getByText('Capa removida')).toBeVisible()
    await expect(page.getByTestId('document-cover')).toHaveCount(0)
    await page.getByLabel('Título do documento').hover()
    await expect(
      page.getByRole('button', { name: 'Adicionar capa' }),
    ).toBeVisible()
  })

  test('accepts an https link as cover and rejects anything else', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('cover-link'))
    await createDocument(page, 'Page with a linked cover')

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar capa' }).click()
    await page.getByTestId('document-cover').hover()
    await page.getByRole('button', { name: 'Alterar capa' }).click()

    const picker = page.getByRole('dialog', { name: 'Capa da página' })

    await picker.getByRole('tab', { name: 'Link' }).click()

    const field = picker.getByLabel('Endereço da imagem')

    await field.fill('ftp://example.com/a.jpg')
    await picker.getByRole('button', { name: 'Usar link' }).click()
    await expect(picker.getByRole('alert')).toHaveText(
      'Cole um endereço https:// de uma imagem',
    )

    await field.fill('https://example.com/cover.jpg')
    await picker.getByRole('button', { name: 'Usar link' }).click()

    await expect(picker).toBeHidden()
    await expect(page.getByTestId('document-cover')).toHaveAttribute(
      'data-cover',
      'https://example.com/cover.jpg',
    )
    await expect(
      page.getByRole('img', { name: 'Capa da página' }),
    ).toBeVisible()
  })

  test('a viewer sees the cover but cannot change it', async ({
    browser,
    page,
  }) => {
    const viewerEmail = uniqueEmail('cover-viewer')

    await signUp(page, uniqueEmail('cover-owner'))
    const documentId = await createDocument(page, 'Shared page with a cover')

    await page.getByLabel('Título do documento').hover()
    await page.getByRole('button', { name: 'Adicionar capa' }).click()
    await expect(page.getByTestId('document-cover')).toBeVisible()

    await page.getByRole('button', { name: 'Compartilhar' }).click()
    await page.getByLabel('Email').fill(viewerEmail)
    await page.getByRole('button', { name: 'Convidar' }).click()
    await expect(page.getByText(viewerEmail)).toBeVisible()

    const viewerContext = await browser.newContext()
    const viewer = await viewerContext.newPage()

    await signUp(viewer, viewerEmail)
    await viewer.goto(`/doc/${documentId}`)

    await expect(viewer.getByTestId('document-cover')).toBeVisible()
    await viewer.getByTestId('document-cover').hover()
    await expect(
      viewer.getByRole('button', { name: 'Alterar capa' }),
    ).toHaveCount(0)

    await viewerContext.close()
  })
})
