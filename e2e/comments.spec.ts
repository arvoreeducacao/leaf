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

async function focusEditorEnd(page: Page) {
  const body = editorBody(page)

  await expect(body).toHaveCount(1)

  await expect(async () => {
    await body.click()
    await expect(body).toBeFocused({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })

  await page.keyboard.press('Control+End')
}

async function selectLastWord(page: Page, length: number) {
  await focusEditorEnd(page)

  for (let index = 0; index < length; index += 1) {
    await page.keyboard.press('Shift+ArrowLeft')
  }
}

function blockShadow(page: Page, blockId: string) {
  return editorBody(page)
    .locator(`.bn-block-outer[data-id="${blockId}"]`)
    .evaluate((element) => window.getComputedStyle(element).boxShadow)
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

test.describe('comments', () => {
  test('block anchor, counter in the header and scroll to the passage', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('commenter'), 'Author')
    await createDocument(page, 'Commented document')

    await typeInEditor(page, 'first paragraph')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second paragraph')
    await waitForSaved(page)

    const blockIds = await editorBody(page)
      .locator('.bn-block-outer[data-id]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-id') ?? ''),
      )

    await selectLastWord(page, 'second paragraph'.length)
    await commentFromToolbar(page, 'This passage needs a source')

    const thread = page.getByTestId('comment-thread').first()

    await expect(thread).toContainText('This passage needs a source')
    await expect(thread).toContainText('Author')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('comments-panel')).toHaveCount(0)
    await expect(page.getByTestId('comments-button')).toContainText('1')

    await openPanel(page)
    await page.getByTestId('comment-anchor').first().click()

    await expect
      .poll(() => blockShadow(page, blockIds[1]))
      .not.toBe('none')
    expect(await blockShadow(page, blockIds[0])).toBe('none')
  })

  test('the margin marker opens the thread on the passage itself', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('margin'), 'Author')
    await createDocument(page, 'Document with a marker')

    await typeInEditor(page, 'first paragraph')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second paragraph')
    await waitForSaved(page)

    await selectLastWord(page, 'second paragraph'.length)
    await commentFromToolbar(page, 'Comment in the margin')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('comments-panel')).toHaveCount(0)

    await page.reload()
    await waitForEditorReady(page)

    const marker = page.getByTestId('inline-comment-marker')

    await expect(marker).toHaveCount(1)

    const blockIds = await editorBody(page)
      .locator('.bn-block-outer[data-id]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-id') ?? ''),
      )

    await expect(marker).toHaveAttribute('data-block-id', blockIds[1])

    const markerBox = await marker.boundingBox()
    const blockBox = await editorBody(page)
      .locator(`.bn-block-outer[data-id="${blockIds[1]}"]`)
      .boundingBox()

    expect(
      Math.abs((markerBox?.y ?? 0) - (blockBox?.y ?? 1_000)),
    ).toBeLessThan(24)

    await marker.click()

    const popover = page.getByTestId('inline-comments-popover')

    await expect(popover).toBeVisible()
    await expect(popover).toContainText('Comment in the margin')

    await popover
      .getByRole('button', { name: 'Responder', exact: true })
      .click()
    await popover.getByLabel(/^Resposta para/).fill('Reply in the margin')
    await popover.getByRole('button', { name: 'Enviar resposta' }).click()
    await expect(popover).toContainText('Reply in the margin')

    await popover.getByRole('button', { name: 'Resolver' }).click()
    await expect(page.getByText('Comentário resolvido').first()).toBeVisible()
    await expect(page.getByTestId('inline-comment-marker')).toHaveCount(0)
  })

  test('reply, resolve, reopen and filter resolved', async ({ page }) => {
    await signUp(page, uniqueEmail('thread'), 'Author')
    await createDocument(page, 'Thread')

    await typeInEditor(page, 'base text')
    await waitForSaved(page)

    await selectLastWord(page, 'base text'.length)
    await commentFromToolbar(page, 'Opening question')

    await page.getByRole('button', { name: 'Responder', exact: true }).click()
    await page.getByLabel(/^Resposta para/).fill('Reply from the author')
    await page.getByRole('button', { name: 'Enviar resposta' }).click()

    await expect(
      page.getByTestId('comment-thread').first(),
    ).toContainText('Reply from the author')

    await page.getByRole('button', { name: 'Resolver' }).click()
    await expect(page.getByText('Comentário resolvido').first()).toBeVisible()

    await expect(page.getByTestId('comment-thread')).toHaveCount(0)
    await expect(
      page.getByText('Todos os comentários foram resolvidos'),
    ).toBeVisible()

    await page.getByRole('switch', { name: 'Mostrar resolvidos' }).click()

    const resolved = page.getByTestId('comment-thread').first()

    await expect(resolved).toBeVisible()
    await expect(resolved).toContainText('Resolvido')

    await page.getByRole('button', { name: 'Reabrir' }).click()
    await expect(page.getByText('Comentário reaberto').first()).toBeVisible()
    await expect(page.getByTestId('comments-button')).toContainText('1')
  })

  test('edit and delete only work for the author', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const guestPage = await guestContext.newPage()
    const guestEmail = uniqueEmail('coauthor')

    await signUp(guestPage, guestEmail, 'Guest')
    await signUp(ownerPage, uniqueEmail('owner'), 'Owner')

    const id = await createDocument(ownerPage, 'Comments with two authors')

    await typeInEditor(ownerPage, 'owner text')
    await waitForSaved(ownerPage)
    await invite(ownerPage, guestEmail, 'Pode editar')

    await selectLastWord(ownerPage, 'owner text'.length)
    await commentFromToolbar(ownerPage, 'Comment from the owner')

    await guestPage.goto(`/doc/${id}`)
    await waitForEditorReady(guestPage)
    await openPanel(guestPage)

    await expect(
      guestPage.getByTestId('comment-thread').first(),
    ).toContainText('Comment from the owner')
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
    await ownerPage.getByLabel('Editar comentário').fill('Revised comment')
    await ownerPage.getByRole('button', { name: 'Salvar' }).click()

    await expect(
      ownerPage.getByTestId('comment-thread').first(),
    ).toContainText('Revised comment')
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

  test('the commenter role comments without editing the document', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const guestPage = await guestContext.newPage()
    const guestEmail = uniqueEmail('reviewer')

    await signUp(guestPage, guestEmail, 'Reviewer')
    await signUp(ownerPage, uniqueEmail('owner'), 'Owner')

    const id = await createDocument(ownerPage, 'Document under review')

    await typeInEditor(ownerPage, 'text to review')
    await waitForSaved(ownerPage)
    await invite(ownerPage, guestEmail, 'Pode comentar')

    await guestPage.goto(`/doc/${id}`)
    await waitForEditorReady(guestPage)

    await expect(guestPage.getByText('Somente leitura')).toBeVisible()
    await expect(editorBody(guestPage)).toHaveCount(0)

    await openPanel(guestPage)
    await guestPage.getByLabel('Novo comentário').fill('Suggestion from the reviewer')
    await guestPage.getByTestId('submit-comment').click()

    await expect(
      guestPage.getByText('Comentário adicionado').first(),
    ).toBeVisible()
    await expect(
      guestPage.getByTestId('comment-thread').first(),
    ).toContainText('Suggestion from the reviewer')

    await ownerPage.reload()
    await waitForEditorReady(ownerPage)
    await expect(ownerPage.getByTestId('comments-button')).toContainText('1')

    await ownerContext.close()
    await guestContext.close()
  })

  test('a viewer sees the threads but does not comment', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const guestPage = await guestContext.newPage()
    const guestEmail = uniqueEmail('viewer')

    await signUp(guestPage, guestEmail, 'Viewer')
    await signUp(ownerPage, uniqueEmail('owner'), 'Owner')

    const id = await createDocument(ownerPage, 'Read-only document')

    await typeInEditor(ownerPage, 'published text')
    await waitForSaved(ownerPage)
    await invite(ownerPage, guestEmail, 'Pode ver')

    await selectLastWord(ownerPage, 'published text'.length)
    await commentFromToolbar(ownerPage, 'Internal note')

    await guestPage.goto(`/doc/${id}`)
    await waitForEditorReady(guestPage)
    await openPanel(guestPage)

    await expect(
      guestPage.getByTestId('comment-thread').first(),
    ).toContainText('Internal note')
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

  test('a deleted block turns the thread into an unanchored one', async ({ page }) => {
    await signUp(page, uniqueEmail('anchor'), 'Author')
    await createDocument(page, 'Document with a lost anchor')

    await typeInEditor(page, 'first line')
    await page.keyboard.press('Enter')
    await page.keyboard.type('line that will vanish')
    await waitForSaved(page)

    await selectLastWord(page, 'line that will vanish'.length)
    await commentFromToolbar(page, 'Orphan comment')

    await expect(page.getByTestId('comment-anchor')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('comments-panel')).toHaveCount(0)

    await focusEditorEnd(page)

    for (let index = 0; index <= 'line that will vanish'.length; index += 1) {
      await page.keyboard.press('Backspace')
    }

    await expect(editorBody(page)).not.toContainText('line that will vanish')
    await waitForSaved(page)

    await openPanel(page)

    await expect(page.getByTestId('comment-unanchored')).toHaveCount(1)
    await expect(page.getByTestId('comment-anchor')).toHaveCount(0)
    await expect(
      page.getByTestId('comment-thread').first(),
    ).toContainText('Orphan comment')
  })

  test('the page comment lives at the foot of the document', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('footer'), 'Author')
    await createDocument(page, 'Document with a footer')

    await typeInEditor(page, 'text of the page')
    await waitForSaved(page)

    const footer = page.getByTestId('document-comments')

    await expect(footer).toBeVisible()
    await expect(footer.getByRole('heading')).toHaveText('Comentários')

    await footer
      .getByTestId('document-comment-input')
      .fill('Does this go to everyone?')
    await footer.getByTestId('submit-document-comment').click()

    await expect(page.getByText('Comentário adicionado').first()).toBeVisible()
    await expect(footer.getByTestId('document-comment-thread')).toHaveCount(1)
    await expect(footer).toContainText('Does this go to everyone?')
    await expect(footer).toContainText('Author')
    await expect(page.getByTestId('comments-button')).toContainText('1')

    await selectLastWord(page, 'page'.length)
    await commentFromToolbar(page, 'And this one stays on the passage')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('comments-panel')).toHaveCount(0)

    await page.reload()
    await waitForEditorReady(page)

    await expect(footer.getByTestId('document-comment-thread')).toHaveCount(1)
    await expect(footer).not.toContainText('And this one stays on the passage')
    await expect(page.getByTestId('inline-comment-marker')).toHaveCount(1)
  })

  test('resolving from the foot of the document closes the conversation', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('footer-resolve'), 'Author')
    await createDocument(page, 'Document to close')

    await typeInEditor(page, 'text to close')
    await waitForSaved(page)

    const footer = page.getByTestId('document-comments')

    await footer.getByTestId('document-comment-input').fill('Can we close it?')
    await footer.getByTestId('submit-document-comment').click()

    await expect(footer.getByTestId('document-comment-thread')).toHaveCount(1)

    await footer.getByRole('button', { name: 'Resolver' }).click()

    await expect(page.getByText('Comentário resolvido').first()).toBeVisible()
    await expect(footer.getByTestId('document-comment-thread')).toHaveCount(0)
    await expect(footer.getByTestId('document-comment-input')).toBeVisible()
  })

  test('the public page does not show comments', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const anonContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const anonPage = await anonContext.newPage()

    await signUp(ownerPage, uniqueEmail('public'), 'Owner')
    await createDocument(ownerPage, 'Commented public document')

    await typeInEditor(ownerPage, 'public content')
    await waitForSaved(ownerPage)

    await selectLastWord(ownerPage, 'public content'.length)
    await commentFromToolbar(ownerPage, 'Private team comment')
    await ownerPage.keyboard.press('Escape')

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByRole('switch', { name: 'Link público' }).click()

    const linkField = ownerPage.getByLabel('Endereço do link')

    await expect(linkField).toBeVisible()

    const url = await linkField.inputValue()

    await anonPage.goto(url)

    await expect(anonPage.getByText('public content')).toBeVisible()
    await expect(anonPage.getByTestId('comments-button')).toHaveCount(0)
    await expect(anonPage.getByTestId('comments-panel')).toHaveCount(0)
    await expect(
      anonPage.getByText('Private team comment'),
    ).toHaveCount(0)

    await ownerContext.close()
    await anonContext.close()
  })
})
