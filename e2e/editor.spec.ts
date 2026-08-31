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
  test('atalhos de markdown viram blocos e o slash menu está em pt-BR', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('editor'))
    await createDocument(page, 'Roteiro da aula')

    const body = editorBody(page)

    await body.click()
    await page.keyboard.type('# Título da seção')
    await page.keyboard.press('Enter')
    await page.keyboard.type('- item de lista')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('> citação do texto')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    await expect(body.locator('h1')).toHaveText('Título da seção')
    await expect(
      body.locator('[data-content-type="bulletListItem"]').first(),
    ).toContainText('item de lista')
    await expect(
      body.locator('[data-content-type="quote"]').first(),
    ).toContainText('citação do texto')

    await page.keyboard.type('/')
    await expect(page.getByText('Lista de tarefas')).toBeVisible()
    await expect(page.getByText('Bloco de código')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('negrito por atalho e link por Ctrl+K na seleção', async ({ page }) => {
    await signUp(page, uniqueEmail('format'))
    await createDocument(page, 'Formatação')

    await typeInEditor(page, 'palavra destacada')

    const body = editorBody(page)

    for (let index = 0; index < 'palavra destacada'.length; index += 1) {
      await page.keyboard.press('Shift+ArrowLeft')
    }

    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('palavra destacada')

    await page.keyboard.press('Control+b')

    await expect(body.locator('strong')).toContainText('palavra destacada')

    await page.keyboard.press('Control+k')

    const urlField = page.locator('.bn-form-popover input').first()

    await expect(urlField).toBeVisible()
    await urlField.fill('https://arvore.com.br')
    await urlField.press('Enter')

    await expect(body.locator('a[href="https://arvore.com.br"]')).toHaveCount(1)
  })

  test('contadores de palavras e caracteres acompanham o texto', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('contador'))
    await createDocument(page, 'Contagem')

    await expect(page.getByText('0 palavras')).toBeVisible()

    await typeInEditor(page, 'uma frase de teste')

    await expect(page.getByText('4 palavras')).toBeVisible()
    await expect(page.getByText('18 caracteres')).toBeVisible()
  })

  test('Enter no título foca o editor e Backspace no bloco vazio volta pro título', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('foco'))
    await createDocument(page)

    const title = page.getByLabel('Título do documento')

    await title.click()
    await title.fill('Documento com foco')
    await page.keyboard.press('Enter')

    await expect(editorBody(page)).toBeFocused()
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Documento com foco',
    )
    await expect(page.getByLabel('Título do documento')).toBeEnabled()

    await page.keyboard.press('Backspace')

    await expect(page.getByLabel('Título do documento')).toBeFocused()
  })

  test('autosave persiste o conteúdo depois do reload', async ({ page }) => {
    await signUp(page, uniqueEmail('autosave'))
    await createDocument(page, 'Persistência')

    await typeInEditor(page, 'conteúdo que precisa sobreviver')
    await waitForSaved(page)

    await page.reload()

    await expect(editorBody(page)).toContainText(
      'conteúdo que precisa sobreviver',
    )
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Persistência',
    )
  })

  test('colar html do Notion vira blocos formatados', async ({ page }) => {
    await signUp(page, uniqueEmail('colar'))
    await createDocument(page, 'Colagem')

    const body = editorBody(page)

    await body.click()

    await page.evaluate(() => {
      const html = [
        '<h2>Plano do bimestre</h2>',
        '<ul><li>Leitura guiada<ul><li>Capítulo um</li></ul></li></ul>',
        '<ul><li>[ ] Enviar convite</li></ul>',
        '<table><tr><th>Nome</th><th>Turma</th></tr><tr><td>Ana</td><td>A</td></tr></table>',
        '<p><img src="https://arvore.com.br/imagem.png" alt="externa"></p>',
      ].join('')

      const target = document.querySelector(
        '.leaf-editor [contenteditable="true"]',
      ) as HTMLElement

      const data = new DataTransfer()

      data.setData('text/html', html)
      data.setData('text/plain', 'Plano do bimestre')

      target.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      )
    })

    await expect(body.locator('h2')).toContainText('Plano do bimestre')
    await expect(body.locator('[data-content-type="bulletListItem"]')).toHaveCount(
      3,
    )
    await expect(body.locator('table')).toHaveCount(1)
    await expect(
      body.locator('img[src="https://arvore.com.br/imagem.png"]'),
    ).toHaveCount(1)
  })

  test('renomear o documento atualiza o title da aba', async ({ page }) => {
    await signUp(page, uniqueEmail('titulo'))
    await createDocument(page)
    await renameDocument(page, 'Diário de bordo')

    await expect(page).toHaveTitle('Diário de bordo | Leaf')

    await page.reload()

    await expect(page).toHaveTitle('Diário de bordo | Leaf')
  })
})
