import { expect, test } from '@playwright/test'

import { createDocument, editorBody, signUp, uniqueEmail } from './helpers'

const markdownFixture = [
  '# Reading plan',
  '',
  '## Class A',
  '',
  'Paragraph with **bold** and a [link](https://example.com).',
  '',
  '- [ ] Send the invite',
  '- [x] Confirm attendance',
  '',
  '| Name | Group |',
  '| --- | --- |',
  '| Ana | A |',
  '',
  '```js',
  'const total = 1 + 1',
  '```',
  '',
].join('\n')

const markdownInput = '[data-testid="import-markdown-input"]'

test.describe('import and export', () => {
  test('the import lives in the slash menu and left the sidebar', async ({ page }) => {
    await signUp(page, uniqueEmail('slash-import'))
    await createDocument(page, 'Document with an import')

    await expect(
      page.getByRole('button', { name: 'Importar arquivo' }),
    ).toHaveCount(0)

    await editorBody(page).click()
    await page.keyboard.type('/')

    await expect(page.getByText('Importar arquivo .md')).toBeVisible()
    await expect(page.getByText('Importar exportação .zip')).toBeVisible()
    await expect(page.getByText(/Notion/)).toHaveCount(0)

    const chooser = page.waitForEvent('filechooser')

    await page.getByText('Importar arquivo .md').click()
    await (
      await chooser
    ).setFiles({
      name: 'note.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Imported note\n\nBody of the note.\n', 'utf8'),
    })

    await expect(page.getByText('Markdown inserido no documento')).toBeVisible()

    const body = editorBody(page)

    await expect(body.locator('h1')).toHaveText('Imported note')
    await expect(body).not.toContainText('/')
  })

  test('imports markdown into the open document and exports md and html with the right content', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('import'))
    const documentId = await createDocument(page, 'Reading plan')

    await page.setInputFiles(markdownInput, {
      name: 'Reading plan.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(markdownFixture, 'utf8'),
    })

    await expect(page.getByText('Markdown inserido no documento')).toBeVisible()

    const body = editorBody(page)

    await expect(body.locator('h1')).toContainText('Reading plan')
    await expect(body.locator('table')).toHaveCount(1)
    await expect(
      body.locator('[data-content-type="checkListItem"]'),
    ).toHaveCount(2)

    await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    const markdown = await page.evaluate(async (id) => {
      const response = await fetch(`/api/documents/${id}/export?format=md`)

      return response.text()
    }, documentId)

    expect(markdown).toContain('# Reading plan')
    expect(markdown).toContain('**bold**')
    expect(markdown).toContain('https://example.com')

    const html = await page.evaluate(async (id) => {
      const response = await fetch(`/api/documents/${id}/export?format=html`)

      return response.text()
    }, documentId)

    expect(html).toContain('<h1>Reading plan</h1>')
    expect(html).not.toContain('classname=')
  })

  test('a huge markdown and a binary file return a clear error without touching the document', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('import-error'))
    await createDocument(page, 'Document that must be left alone')

    await page.setInputFiles(markdownInput, {
      name: 'huge.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('a'.repeat(3 * 1024 * 1024), 'utf8'),
    })

    await expect(page.getByText(/passa de 2 MB/)).toBeVisible()

    await page.setInputFiles(markdownInput, {
      name: 'binary.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]),
    })

    await expect(
      page.getByText(/não parece ser um markdown de texto/),
    ).toBeVisible()

    await page.reload()

    const privateSection = page.getByRole('region', { name: 'Privado' })

    await expect(privateSection.getByRole('link')).toHaveCount(1)
    await expect(editorBody(page)).toHaveText('')
  })

  test('an uploaded image shows up after the reload and goes absolute in the export', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('upload'))
    const id = await createDocument(page, 'Document with an image')

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )

    const url = await page.evaluate(async (bytes) => {
      const data = new FormData()

      data.append(
        'file',
        new File([new Uint8Array(bytes)], 'dot.png', { type: 'image/png' }),
      )

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: data,
      })

      const json = (await response.json()) as { url?: string }

      return json.url ?? ''
    }, Array.from(png))

    expect(url).toMatch(/^\/api\/uploads\//)

    const proxied = await page.request.get(url)

    expect(proxied.status()).toBe(200)
    expect(proxied.headers()['content-type']).toContain('image/png')
    expect(proxied.headers()['x-content-type-options']).toBe('nosniff')

    await page.setInputFiles(markdownInput, {
      name: 'With image.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(`![Cover](${url})\n`, 'utf8'),
    })

    await expect(page.getByText('Markdown inserido no documento')).toBeVisible()
    await expect(editorBody(page).locator('img')).toHaveCount(1)
    await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    const markdown = await page.evaluate(async (docId) => {
      const response = await fetch(`/api/documents/${docId}/export?format=md`)

      return response.text()
    }, id)

    expect(markdown).toMatch(
      new RegExp(`http://(127\\.0\\.0\\.1|localhost):3100${url}`),
    )
    expect(markdown).not.toContain(`](${url})`)
  })
})
