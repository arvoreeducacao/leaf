import { expect, test } from '@playwright/test'

import { buildNotionFixtureZip, fixtureTitles } from '../src/lib/notion/fixture'
import { createDocument, editorBody, signUp, uniqueEmail } from './helpers'

const archiveInput = '[data-testid="import-archive-input"]'

test.describe('importar exportação', () => {
  test('zip vira subpáginas com imagem, callout e database', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('zip'))
    await createDocument(page, 'Migração')

    await page.setInputFiles(archiveInput, {
      name: 'exportacao.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildNotionFixtureZip()),
    })

    await expect(page.getByText('Importar exportação').first()).toBeVisible()

    await expect(page.getByText(/páginas criadas/)).toBeVisible({
      timeout: 60_000,
    })

    await page.getByRole('button', { name: 'Abrir documento' }).click()

    await expect(page.getByLabel('Título do documento')).toHaveValue(
      fixtureTitles.plano,
    )

    const body = editorBody(page)

    await expect(body).toContainText('Roteiro do trimestre')
    await expect(body).toContainText('Combine as datas com a coordenação')

    await expect(
      page.getByRole('navigation', { name: 'Caminho do documento' }),
    ).toContainText('Migração')

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await nav
      .getByRole('button', { name: `Expandir ${fixtureTitles.plano}` })
      .click()
    await nav.getByRole('link', { name: new RegExp(fixtureTitles.turma) }).click()

    await expect(page.getByLabel('Título do documento')).toHaveValue(
      fixtureTitles.turma,
    )
    await expect(editorBody(page).locator('img')).toHaveCount(1)
    await expect(
      page.getByRole('navigation', { name: 'Caminho do documento' }),
    ).toContainText(fixtureTitles.plano)
  })

  test('zip corrompido devolve erro sem quebrar o app', async ({ page }) => {
    await signUp(page, uniqueEmail('zip-erro'))
    await createDocument(page, 'Documento intacto')

    await page.setInputFiles(archiveInput, {
      name: 'quebrado.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('PK isso nao e um zip de verdade', 'utf8'),
    })

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('button', { name: 'Tentar de novo' }),
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link')).toHaveCount(1)
  })
})
