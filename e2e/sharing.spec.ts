import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

test.describe('sharing', () => {
  test('a signed-in person without access sees a permission notice', async ({
    browser,
  }) => {
    const owner = await browser.newContext()
    const stranger = await browser.newContext()
    const ownerPage = await owner.newPage()
    const strangerPage = await stranger.newPage()

    await signUp(strangerPage, uniqueEmail('stranger'), 'Stranger')
    await signUp(ownerPage, uniqueEmail('owner'), 'Owner')
    await ownerPage.getByRole('button', { name: 'Novo documento' }).first().click()
    await ownerPage.waitForURL(/\/doc\/[\w-]+$/)
    const id = ownerPage.url().split('/doc/')[1]

    await strangerPage.goto(`/doc/${id}`)
    await expect(
      strangerPage.getByRole('heading', {
        name: 'Você não tem acesso a este documento',
      }),
    ).toBeVisible()
    await strangerPage.screenshot({
      path: process.env.ACCESS_DENIED_SHOT ?? 'test-results/access-denied.png',
    })

    await strangerPage.goto('/doc/does-not-exist')
    await expect(
      strangerPage.getByRole('heading', { name: 'Documento não encontrado' }),
    ).toBeVisible()

    await owner.close()
    await stranger.close()
  })

  test('the guest sees it as a viewer and then can edit', async ({
    browser,
  }) => {
    const owner = await browser.newContext()
    const guest = await browser.newContext()
    const ownerPage = await owner.newPage()
    const guestPage = await guest.newPage()
    const guestEmail = uniqueEmail('guest')

    await signUp(guestPage, guestEmail, 'Guest')

    await signUp(ownerPage, uniqueEmail('owner'), 'Owner')
    const id = await createDocument(ownerPage, 'Shared document')

    await typeInEditor(ownerPage, 'owner text')
    await waitForSaved(ownerPage)

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByLabel('Email', { exact: true }).fill(guestEmail)
    await ownerPage.getByRole('button', { name: 'Convidar' }).click()
    await expect(ownerPage.getByText(guestEmail)).toBeVisible()

    await guestPage.goto(`/doc/${id}`)
    await expect(guestPage.getByText('Somente leitura')).toBeVisible()
    await expect(editorBody(guestPage)).toHaveCount(0)

    await ownerPage
      .getByRole('combobox', { name: `Papel de ${guestEmail}` })
      .click()
    await ownerPage.getByRole('option', { name: 'Pode editar' }).click()
    await expect(ownerPage.getByText('Papel atualizado')).toBeVisible()

    await guestPage.reload()
    await expect(guestPage.getByText('Somente leitura')).toHaveCount(0)
    await expect(editorBody(guestPage)).toHaveCount(1)

    await owner.close()
    await guest.close()
  })

  test('the public link opens without a session and stops working once disabled', async ({
    browser,
  }) => {
    const owner = await browser.newContext()
    const anon = await browser.newContext()
    const ownerPage = await owner.newPage()
    const anonPage = await anon.newPage()

    await signUp(ownerPage, uniqueEmail('public'), 'Owner')
    await createDocument(ownerPage, 'Public document')
    await typeInEditor(ownerPage, 'content visible to everyone')
    await waitForSaved(ownerPage)

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByRole('switch', { name: 'Link público' }).click()

    const linkField = ownerPage.getByLabel('Endereço do link')

    await expect(linkField).toHaveValue(/\/share\//)
    const shareUrl = await linkField.inputValue()

    await anonPage.goto(shareUrl)
    await expect(anonPage.getByText('content visible to everyone')).toBeVisible()
    await expect(anonPage.getByText('Digite / para comandos')).toHaveCount(0)

    await ownerPage.getByRole('switch', { name: 'Link público' }).click()
    await ownerPage
      .getByRole('button', { name: 'Desativar link' })
      .click()
    await expect(
      ownerPage.getByRole('switch', { name: 'Link público' }),
    ).toHaveAttribute('aria-checked', 'false')

    const response = await anonPage.goto(shareUrl)

    expect(response?.status()).toBe(404)

    await owner.close()
    await anon.close()
  })
})
