import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForEditorReady,
  waitForPageCached,
  waitForQueuedOffline,
  waitForServiceWorker,
} from './helpers'

test.describe('collaboration that survives a dropped connection', () => {
  test('what was written offline reaches the server on reconnect', async ({
    context,
    page,
  }) => {
    await signUp(page, uniqueEmail('offline-colab'))

    const id = await createDocument(page, 'Offline collaborative document')

    await expect(page.getByText('Colaboração em tempo real').first()).toBeVisible({
      timeout: 20_000,
    })

    await typeInEditor(page, 'online line')
    await waitForServiceWorker(page)
    await waitForPageCached(page)

    await context.setOffline(true)

    await expect(page.getByText('Offline · salvo neste aparelho').first()).toBeVisible({
      timeout: 20_000,
    })

    await editorBody(page).click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('offline line')

    await waitForQueuedOffline(page, id, 'offline line')

    await page.reload()
    await waitForEditorReady(page)

    await expect(editorBody(page)).toContainText('online line')
    await expect(editorBody(page)).toContainText('offline line')

    await context.setOffline(false)

    await expect(page.getByText('Colaboração em tempo real').first()).toBeVisible({
      timeout: 30_000,
    })

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
      .toContain('offline line')
  })
})
