import { expect, test } from '@playwright/test'

import { createDocument, editorBody, signUp, uniqueEmail } from './helpers'

const markdownFixture = [
  '# Plano de leitura',
  '',
  '## Turma A',
  '',
  'Parágrafo com **negrito** e um [link](https://arvore.com.br).',
  '',
  '- [ ] Enviar convite',
  '- [x] Confirmar presença',
  '',
  '| Nome | Turma |',
  '| --- | --- |',
  '| Ana | A |',
  '',
  '```js',
  'const total = 1 + 1',
  '```',
  '',
].join('\n')

test.describe('importar e exportar', () => {
  test('importa markdown e exporta md e html com o conteúdo certo', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('import'))

    await page.setInputFiles('input[type="file"]', {
      name: 'Plano de leitura.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(markdownFixture, 'utf8'),
    })

    await expect(page.getByText('Markdown importado')).toBeVisible()
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Plano de leitura',
    )

    const body = editorBody(page)

    await expect(body.locator('h1')).toContainText('Plano de leitura')
    await expect(body.locator('table')).toHaveCount(1)
    await expect(
      body.locator('[data-content-type="checkListItem"]'),
    ).toHaveCount(2)

    const documentId = page.url().split('/doc/')[1]

    const markdown = await page.evaluate(async (id) => {
      const response = await fetch(`/api/documents/${id}/export?format=md`)

      return response.text()
    }, documentId)

    expect(markdown).toContain('# Plano de leitura')
    expect(markdown).toContain('**negrito**')
    expect(markdown).toContain('https://arvore.com.br')

    const html = await page.evaluate(async (id) => {
      const response = await fetch(`/api/documents/${id}/export?format=html`)

      return response.text()
    }, documentId)

    expect(html).toContain('<h1>Plano de leitura</h1>')
    expect(html).not.toContain('classname=')
  })

  test('markdown gigante e arquivo binário devolvem erro claro sem criar documento', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('import-erro'))
    await createDocument(page, 'Documento que deve ficar sozinho')

    await page.setInputFiles('input[type="file"]', {
      name: 'gigante.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('a'.repeat(3 * 1024 * 1024), 'utf8'),
    })

    await expect(page.getByText(/passa de 2 MB/)).toBeVisible()

    await page.setInputFiles('input[type="file"]', {
      name: 'binario.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]),
    })

    await expect(
      page.getByText(/não parece ser um markdown de texto/),
    ).toBeVisible()

    await page.reload()

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link')).toHaveCount(1)
  })

  test('imagem enviada aparece depois do reload e vai absoluta no export', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('upload'))
    const id = await createDocument(page, 'Documento com imagem')

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )

    const url = await page.evaluate(async (bytes) => {
      const data = new FormData()

      data.append(
        'file',
        new File([new Uint8Array(bytes)], 'ponto.png', { type: 'image/png' }),
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

    await page.setInputFiles('input[type="file"]', {
      name: 'Com imagem.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(`# Com imagem\n\n![Capa](${url})\n`, 'utf8'),
    })

    await expect(page.getByText('Markdown importado')).toBeVisible()
    await page.waitForURL((current) => !current.pathname.endsWith(id))

    const importedId = page.url().split('/doc/')[1]

    expect(importedId).not.toBe(id)

    const markdown = await page.evaluate(async (docId) => {
      const response = await fetch(`/api/documents/${docId}/export?format=md`)

      return response.text()
    }, importedId)

    expect(markdown).toMatch(
      new RegExp(`http://(127\\.0\\.0\\.1|localhost):3100${url}`),
    )
    expect(markdown).not.toContain(`](${url})`)
  })
})
