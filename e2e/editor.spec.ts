import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  renameDocument,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

test.describe('editor', () => {
  test('markdown shortcuts become blocks and the slash menu is in pt-BR', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('editor'))
    await createDocument(page, 'Lesson outline')

    const body = editorBody(page)

    await body.click()
    await page.keyboard.type('# Section title')
    await page.keyboard.press('Enter')
    await page.keyboard.type('- list item')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('> quote from the text')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    await expect(body.locator('h1')).toHaveText('Section title')
    await expect(
      body.locator('[data-content-type="bulletListItem"]').first(),
    ).toContainText('list item')
    await expect(
      body.locator('[data-content-type="quote"]').first(),
    ).toContainText('quote from the text')

    await page.keyboard.type('/')
    await expect(page.getByText('Lista de tarefas')).toBeVisible()
    await expect(page.getByText('Bloco de código')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('bold by shortcut and link by Ctrl+K on the selection', async ({ page }) => {
    await signUp(page, uniqueEmail('format'))
    await createDocument(page, 'Formatting')

    await typeInEditor(page, 'highlighted word')

    const body = editorBody(page)

    for (let index = 0; index < 'highlighted word'.length; index += 1) {
      await page.keyboard.press('Shift+ArrowLeft')
    }

    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('highlighted word')

    await page.keyboard.press('Control+b')

    await expect(body.locator('strong')).toContainText('highlighted word')

    await page.keyboard.press('Control+k')

    const urlField = page.locator('.bn-form-popover input').first()

    await expect(urlField).toBeVisible()
    await urlField.fill('https://example.com')
    await urlField.press('Enter')

    await expect(body.locator('a[href="https://example.com"]')).toHaveCount(1)
  })

  test('word and character counters follow the text', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('counter'))
    await createDocument(page, 'Counting')

    await expect(page.getByText('0 palavras')).toBeVisible()

    await typeInEditor(page, 'just a test phrase')

    await expect(page.getByText('4 palavras')).toBeVisible()
    await expect(page.getByText('18 caracteres')).toBeVisible()
  })

  test('Enter on the title focuses the editor and Backspace on the empty block goes back to the title', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('focus'))
    await createDocument(page)

    const title = page.getByLabel('Título do documento')

    await title.click()
    await title.fill('Document with focus')
    await page.keyboard.press('Enter')

    await expect(editorBody(page)).toBeFocused()
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Document with focus',
    )
    await expect(page.getByLabel('Título do documento')).toBeEnabled()

    await page.keyboard.press('Backspace')

    await expect(page.getByLabel('Título do documento')).toBeFocused()
  })

  test('autosave keeps the content after the reload', async ({ page }) => {
    await signUp(page, uniqueEmail('autosave'))
    await createDocument(page, 'Persistence')

    await typeInEditor(page, 'content that has to survive')
    await waitForSaved(page)

    await page.reload()

    await expect(editorBody(page)).toContainText(
      'content that has to survive',
    )
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Persistence',
    )
  })

  test('pasting Notion html becomes formatted blocks', async ({ page }) => {
    await signUp(page, uniqueEmail('paste'))
    await createDocument(page, 'Pasting')

    const body = editorBody(page)

    await body.click()

    await page.evaluate(() => {
      const html = [
        '<h2>Term plan</h2>',
        '<ul><li>Guided reading<ul><li>Chapter one</li></ul></li></ul>',
        '<ul><li>[ ] Send the invite</li></ul>',
        '<table><tr><th>Name</th><th>Group</th></tr><tr><td>Ana</td><td>A</td></tr></table>',
        '<p><img src="https://example.com/image.png" alt="external"></p>',
      ].join('')

      const target = document.querySelector(
        '.leaf-editor [contenteditable="true"]',
      ) as HTMLElement

      const data = new DataTransfer()

      data.setData('text/html', html)
      data.setData('text/plain', 'Term plan')

      target.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      )
    })

    await expect(body.locator('h2')).toContainText('Term plan')
    await expect(body.locator('[data-content-type="bulletListItem"]')).toHaveCount(
      3,
    )
    await expect(body.locator('table')).toHaveCount(1)
    await expect(
      body.locator('img[src="https://example.com/image.png"]'),
    ).toHaveCount(1)
  })

  test('renaming the document updates the tab title', async ({ page }) => {
    await signUp(page, uniqueEmail('title'))
    await createDocument(page)
    await renameDocument(page, 'Logbook')

    await expect(page).toHaveTitle('Logbook | Leaf')

    await page.reload()

    await expect(page).toHaveTitle('Logbook | Leaf')
  })
})
