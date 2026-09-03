import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForEditorReady,
  waitForSaved,
  waitForPageCached,
  waitForQueuedOffline,
  waitForServiceWorker,
} from './helpers'

test.describe('editing without a connection', () => {
  test('the open document stays editable and reaches the server later', async ({
    context,
    page,
  }) => {
    await signUp(page, uniqueEmail('offline'))

    const id = await createDocument(page, 'Offline document')

    await typeInEditor(page, 'written with internet')
    await waitForSaved(page)
    await waitForServiceWorker(page)
    await waitForPageCached(page)

    await context.setOffline(true)

    await editorBody(page).click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('written without internet')

    await expect(page.getByText('Offline · salvo neste aparelho').first()).toBeVisible({
      timeout: 20_000,
    })
    await waitForQueuedOffline(page, id, 'written without internet')

    await page.reload()
    await waitForEditorReady(page)

    await expect(editorBody(page)).toContainText('written with internet')
    await expect(editorBody(page)).toContainText('written without internet')

    await context.setOffline(false)
    await waitForSaved(page)

    await expect
      .poll(
        async () => {
          const response = await page.request.get(
            `/api/documents/${id}/snapshot`,
          )

          return response.ok() ? JSON.stringify(await response.json()) : ''
        },
        { timeout: 30_000 },
      )
      .toContain('written without internet')
  })

  test('a document with no local copy says it is not available yet', async ({
    context,
    page,
  }) => {
    await signUp(page, uniqueEmail('offline-sem-copia'))

    const id = await createDocument(page, 'Document without a local copy')

    await typeInEditor(page, 'content on the server')
    await waitForSaved(page)

    await page.goto(`/doc/${id}`)
    await waitForEditorReady(page)
    await waitForServiceWorker(page)
    await waitForPageCached(page)

    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'Novo documento' }).first(),
    ).toBeVisible()
    await page.evaluate(
      (documentId) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(`doc:${documentId}`)

          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
          request.onblocked = () => resolve()
        }),
      id,
    )

    await context.setOffline(true)
    await page.goto(`/doc/${id}`)

    await expect(
      page.getByText('Este documento ainda não está disponível offline'),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('a page that was never loaded falls back to the offline screen', async ({
    context,
    page,
  }) => {
    await signUp(page, uniqueEmail('offline-pagina'))
    await createDocument(page, 'Any document')
    await waitForEditorReady(page)
    await waitForServiceWorker(page)
    await waitForPageCached(page)

    await context.setOffline(true)
    await page.goto('/doc/nunca-visto-1')

    await expect(page.getByText('Você está sem conexão')).toBeVisible({
      timeout: 30_000,
    })
  })
})
