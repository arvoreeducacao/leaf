import { expect, test, type Page } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForEditorReady,
  waitForSaved,
} from './helpers'

async function selectLastWord(page: Page, length: number) {
  for (let index = 0; index < length; index += 1) {
    await page.keyboard.press('Shift+ArrowLeft')
  }
}

async function openPanel(page: Page) {
  await page.getByTestId('comments-button').click()
  await expect(page.getByTestId('comments-panel')).toBeVisible()
}

async function commentFromToolbar(page: Page, body: string) {
  await page.getByRole('button', { name: 'Comentar', exact: true }).click()
  await expect(page.getByTestId('comments-panel')).toBeVisible()
  await page.getByLabel('Novo comentário').fill(body)
  await page.getByTestId('submit-comment').click()
  await expect(page.getByText('Comentário adicionado').first()).toBeVisible()
}

async function invite(page: Page, email: string, role: string) {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('combobox', { name: 'Papel' }).click()
  await page.getByRole('option', { name: role }).click()
  await page.getByRole('button', { name: 'Convidar' }).click()
  await expect(page.getByText(email).first()).toBeVisible()
  await page.keyboard.press('Escape')
}

test.describe('comentários', () => {
  test('âncora em bloco, contador no header e rolagem até o trecho', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('comentador'), 'Autora')
    await createDocument(page, 'Documento comentado')

    await typeInEditor(page, 'primeiro paragrafo')
    await page.keyboard.press('Enter')
    await page.keyboard.type('segundo paragrafo')
    await waitForSaved(page)

    const blocks = editorBody(page).locator('[data-id]')
    const firstBlockId = await blocks.first().getAttribute('data-id')

    await selectLastWord(page, 'segundo paragrafo'.length)
    await commentFromToolbar(page, 'Este trecho precisa de fonte')

    const thread = page.getByTestId('comment-thread').first()

    await expect(thread).toContainText('Este trecho precisa de fonte')
    await expect(thread).toContainText('Autora')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('comments-panel')).toHaveCount(0)
    await expect(page.getByTestId('comments-button')).toContainText('1')

    await openPanel(page)
    await page.getByTestId('comment-anchor').first().click()

    await expect(
      editorBody(page).locator('.leaf-comment-target'),
    ).toHaveCount(1)
    await expect(
      editorBody(page).locator(`[data-id="${firstBlockId}"]`),
    ).not.toHaveClass(/leaf-comment-target/)
  })

  test('responder, resolver, reabrir e filtrar resolvidos', async ({ page }) => {
    await signUp(page, uniqueEmail('thread'), 'Autora')
    await createDocument(page, 'Conversa')

    await typeInEditor(page, 'texto base')
    await waitForSaved(page)

    await selectLastWord(page, 'texto base'.length)
    await commentFromToolbar(page, 'Pergunta inicial')

    await page.getByRole('button', { name: 'Responder', exact: true }).click()
    await page.getByLabel(/^Resposta para/).fill('Resposta da autora')
    await page.getByRole('button', { name: 'Enviar resposta' }).click()

    await expect(
      page.getByTestId('comment-thread').first(),
    ).toContainText('Resposta da autora')

    await page.getByRole('button', { name: 'Resolver' }).click()
    await expect(page.getByText('Comentário resolvido').first()).toBeVisible()

    await expect(page.getByTestId('comment-thread')).toHaveCount(0)
    await expect(page.getByText('Ainda não há comentários')).toBeVisible()

    await page.getByRole('switch', { name: 'Mostrar resolvidos' }).click()

    const resolved = page.getByTestId('comment-thread').first()

    await expect(resolved).toBeVisible()
    await expect(resolved).toContainText('Resolvido')

    await page.getByRole('button', { name: 'Reabrir' }).click()
    await expect(page.getByText('Comentário reaberto').first()).toBeVisible()
    await expect(page.getByTestId('comments-button')).toContainText('1')
  })

  test('editar e excluir só valem para o autor', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const guestPage = await guestContext.newPage()
    const guestEmail = uniqueEmail('coautor')

    await signUp(guestPage, guestEmail, 'Convidado')
    await signUp(ownerPage, uniqueEmail('dono'), 'Dono')

    const id = await createDocument(ownerPage, 'Comentários com dois autores')

    await typeInEditor(ownerPage, 'texto do dono')
    await waitForSaved(ownerPage)
    await invite(ownerPage, guestEmail, 'Pode editar')

    await selectLastWord(ownerPage, 'texto do dono'.length)
    await commentFromToolbar(ownerPage, 'Comentário do dono')

    await guestPage.goto(`/doc/${id}`)
    await waitForEditorReady(guestPage)
    await openPanel(guestPage)

    await expect(
      guestPage.getByTestId('comment-thread').first(),
    ).toContainText('Comentário do dono')
    await expect(
      guestPage.getByRole('button', { name: 'Editar' }),
    ).toHaveCount(0)
    await expect(
      guestPage.getByRole('button', { name: 'Excluir' }),
    ).toHaveCount(0)
    await expect(
      guestPage.getByRole('button', { name: 'Resolver' }),
    ).toHaveCount(1)

    await ownerPage.getByRole('button', { name: 'Editar' }).click()
    await ownerPage.getByLabel('Editar comentário').fill('Comentário revisado')
    await ownerPage.getByRole('button', { name: 'Salvar' }).click()

    await expect(
      ownerPage.getByTestId('comment-thread').first(),
    ).toContainText('Comentário revisado')
    await expect(
      ownerPage.getByTestId('comment-thread').first(),
    ).toContainText('editado')

    await ownerPage.getByRole('button', { name: 'Excluir' }).click()
    await ownerPage
      .getByRole('button', { name: 'Excluir', exact: true })
      .last()
      .click()

    await expect(ownerPage.getByText('Comentário excluído').first()).toBeVisible()
    await expect(ownerPage.getByTestId('comment-thread')).toHaveCount(0)

    await ownerContext.close()
    await guestContext.close()
  })

  test('papel Pode comentar comenta sem editar o documento', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const guestPage = await guestContext.newPage()
    const guestEmail = uniqueEmail('revisor')

    await signUp(guestPage, guestEmail, 'Revisor')
    await signUp(ownerPage, uniqueEmail('dono'), 'Dono')

    const id = await createDocument(ownerPage, 'Documento em revisão')

    await typeInEditor(ownerPage, 'texto para revisar')
    await waitForSaved(ownerPage)
    await invite(ownerPage, guestEmail, 'Pode comentar')

    await guestPage.goto(`/doc/${id}`)
    await waitForEditorReady(guestPage)

    await expect(guestPage.getByText('Somente leitura')).toBeVisible()
    await expect(editorBody(guestPage)).toHaveCount(0)

    await openPanel(guestPage)
    await guestPage.getByLabel('Novo comentário').fill('Sugestão do revisor')
    await guestPage.getByTestId('submit-comment').click()

    await expect(
      guestPage.getByText('Comentário adicionado').first(),
    ).toBeVisible()
    await expect(
      guestPage.getByTestId('comment-thread').first(),
    ).toContainText('Sugestão do revisor')

    await ownerPage.reload()
    await waitForEditorReady(ownerPage)
    await expect(ownerPage.getByTestId('comments-button')).toContainText('1')

    await ownerContext.close()
    await guestContext.close()
  })

  test('leitor vê as conversas mas não comenta', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const guestPage = await guestContext.newPage()
    const guestEmail = uniqueEmail('leitor')

    await signUp(guestPage, guestEmail, 'Leitor')
    await signUp(ownerPage, uniqueEmail('dono'), 'Dono')

    const id = await createDocument(ownerPage, 'Documento só de leitura')

    await typeInEditor(ownerPage, 'texto publicado')
    await waitForSaved(ownerPage)
    await invite(ownerPage, guestEmail, 'Pode ver')

    await selectLastWord(ownerPage, 'texto publicado'.length)
    await commentFromToolbar(ownerPage, 'Nota interna')

    await guestPage.goto(`/doc/${id}`)
    await waitForEditorReady(guestPage)
    await openPanel(guestPage)

    await expect(
      guestPage.getByTestId('comment-thread').first(),
    ).toContainText('Nota interna')
    await expect(guestPage.getByLabel('Novo comentário')).toHaveCount(0)
    await expect(guestPage.getByTestId('submit-comment')).toHaveCount(0)
    await expect(
      guestPage.getByText(
        'Você pode ler os comentários, mas não comentar neste documento.',
      ),
    ).toBeVisible()
    await expect(
      guestPage.getByRole('button', { name: 'Responder' }),
    ).toHaveCount(0)

    await ownerContext.close()
    await guestContext.close()
  })

  test('bloco apagado transforma a conversa em sem âncora', async ({ page }) => {
    await signUp(page, uniqueEmail('ancora'), 'Autora')
    await createDocument(page, 'Documento com âncora perdida')

    await typeInEditor(page, 'primeira linha')
    await page.keyboard.press('Enter')
    await page.keyboard.type('linha que vai sumir')
    await waitForSaved(page)

    await selectLastWord(page, 'linha que vai sumir'.length)
    await commentFromToolbar(page, 'Comentário órfão')

    await expect(page.getByTestId('comment-anchor')).toHaveCount(1)

    await page.keyboard.press('Escape')

    const body = editorBody(page)

    await body.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await waitForSaved(page)

    await openPanel(page)

    await expect(page.getByTestId('comment-unanchored')).toHaveCount(1)
    await expect(page.getByTestId('comment-anchor')).toHaveCount(0)
    await expect(
      page.getByTestId('comment-thread').first(),
    ).toContainText('Comentário órfão')
  })

  test('a página pública não mostra comentários', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const anonContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const anonPage = await anonContext.newPage()

    await signUp(ownerPage, uniqueEmail('publico'), 'Dono')
    await createDocument(ownerPage, 'Documento público comentado')

    await typeInEditor(ownerPage, 'conteudo publico')
    await waitForSaved(ownerPage)

    await selectLastWord(ownerPage, 'conteudo publico'.length)
    await commentFromToolbar(ownerPage, 'Comentário privado da equipe')
    await ownerPage.keyboard.press('Escape')

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByRole('switch', { name: 'Link público' }).click()

    const linkField = ownerPage.getByLabel('Endereço do link')

    await expect(linkField).toBeVisible()

    const url = await linkField.inputValue()

    await anonPage.goto(url)

    await expect(anonPage.getByText('conteudo publico')).toBeVisible()
    await expect(anonPage.getByTestId('comments-button')).toHaveCount(0)
    await expect(anonPage.getByTestId('comments-panel')).toHaveCount(0)
    await expect(
      anonPage.getByText('Comentário privado da equipe'),
    ).toHaveCount(0)

    await ownerContext.close()
    await anonContext.close()
  })
})
