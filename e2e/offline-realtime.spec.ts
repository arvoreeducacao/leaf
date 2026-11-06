import { expect, test, type Page } from '@playwright/test'
import * as Y from 'yjs'

import { realtimeFragmentName, realtimeRoomName } from '../src/lib/realtime'

import {
  createDocument,
  editorBody,
  signUp,
  trackCollaboration,
  typeInEditor,
  uniqueEmail,
  waitForCollaboration,
  waitForEditorReady,
  waitForPageCached,
  waitForServiceWorker,
} from './helpers'

async function localCopyText(page: Page, documentId: string) {
  const updates = await page.evaluate(
    (room) =>
      new Promise<Array<Array<number>>>((resolve) => {
        const open = indexedDB.open(room)

        open.onerror = () => resolve([])
        open.onsuccess = () => {
          const db = open.result

          if (!db.objectStoreNames.contains('updates')) {
            db.close()
            resolve([])

            return
          }

          const read = db
            .transaction('updates', 'readonly')
            .objectStore('updates')
            .getAll()

          read.onerror = () => {
            db.close()
            resolve([])
          }
          read.onsuccess = () => {
            db.close()
            resolve(
              (read.result as Array<Uint8Array>).map((update) =>
                Array.from(update),
              ),
            )
          }
        }
      }),
    realtimeRoomName(documentId),
  )
  const doc = new Y.Doc()

  for (const update of updates) {
    Y.applyUpdate(doc, new Uint8Array(update))
  }

  const text = doc.getXmlFragment(realtimeFragmentName).toString()

  doc.destroy()

  return text
}

test.describe('collaboration that survives a dropped connection', () => {
  test('what was written offline reaches the server on reconnect', async ({
    context,
    page,
  }) => {
    trackCollaboration(page)
    await signUp(page, uniqueEmail('offline-colab'))

    const id = await createDocument(page, 'Offline collaborative document')

    await waitForCollaboration(page)

    await typeInEditor(page, 'online line')
    await waitForServiceWorker(page)
    await waitForPageCached(page)

    await context.setOffline(true)

    await expect(
      page.getByText(
        'Sem colaboração ao vivo. Suas mudanças estão salvas neste aparelho',
      ),
    ).toBeVisible({ timeout: 20_000 })

    await editorBody(page).click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('offline line')

    await expect
      .poll(() => localCopyText(page, id), { timeout: 10_000 })
      .toContain('offline line')

    await page.reload()
    await waitForEditorReady(page)

    await expect(editorBody(page)).toContainText('online line')
    await expect(editorBody(page)).toContainText('offline line')

    await context.setOffline(false)

    await waitForCollaboration(page, 30_000)

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
