import { expect, type Page, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

async function createOrganization(page: Page, name: string) {
  await page.goto('/org')
  await page.getByLabel('Nome da organização').fill(name)
  await page.getByRole('button', { name: 'Criar organização' }).click()
  await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible()
}

async function inviteToOrganization(page: Page, email: string) {
  await page.goto('/org')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Convidar', exact: true }).click()
  await expect(page.getByText(email).first()).toBeVisible()
}

async function setOrganizationAccess(page: Page, option: string) {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  await page
    .getByRole('combobox', { name: 'Acesso da organização' })
    .click()
  await page.getByRole('option', { name: option }).click()
  await expect(page.getByText('Acesso da organização atualizado')).toBeVisible()
  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

function sidebarSection(page: Page, name: string) {
  return page.getByRole('heading', { level: 2, name })
}

test.describe('organizations', () => {
  test('private by default, org_access grants reading and then editing', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext()
    const memberContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const memberPage = await memberContext.newPage()
    const guestPage = await guestContext.newPage()

    const memberEmail = uniqueEmail('member')
    const guestEmail = uniqueEmail('external')

    await signUp(ownerPage, uniqueEmail('owner'), 'Org Owner')
    await createOrganization(ownerPage, 'Test School')
    await inviteToOrganization(ownerPage, memberEmail)

    await signUp(memberPage, memberEmail, 'Member')
    await expect(sidebarSection(memberPage, 'Organização')).toBeVisible()

    const id = await createDocument(ownerPage, 'Team plan')
    await typeInEditor(ownerPage, 'team content')
    await waitForSaved(ownerPage)

    await expect(sidebarSection(ownerPage, 'Privado')).toBeVisible()
    await expect(
      ownerPage.getByTestId('document-org-tag'),
    ).toHaveCount(0)

    await memberPage.goto(`/doc/${id}`)
    await expect(
      memberPage.getByRole('heading', { name: 'Documento não encontrado' }),
    ).toBeVisible()
    await expect(
      memberPage.getByRole('link', { name: 'Team plan' }),
    ).toHaveCount(0)

    await ownerPage.goto(`/doc/${id}`)
    await setOrganizationAccess(ownerPage, 'Pode ver')
    await expect(ownerPage.getByTestId('document-org-tag')).toBeVisible()

    await memberPage.goto(`/doc/${id}`)
    await expect(memberPage.getByText('Somente leitura')).toBeVisible()
    await expect(editorBody(memberPage)).toHaveCount(0)
    await expect(
      memberPage
        .getByRole('region', { name: 'Organização' })
        .getByRole('link', { name: 'Team plan' }),
    ).toBeVisible()

    await ownerPage.goto(`/doc/${id}`)
    await setOrganizationAccess(ownerPage, 'Pode editar')

    await memberPage.goto(`/doc/${id}`)
    await expect(memberPage.getByText('Somente leitura')).toHaveCount(0)
    await typeInEditor(memberPage, ' edited by the member')
    await waitForSaved(memberPage)

    await signUp(guestPage, guestEmail, 'External')
    await expect(sidebarSection(guestPage, 'Organização')).toHaveCount(0)

    await guestPage.goto(`/doc/${id}`)
    await expect(
      guestPage.getByRole('heading', { name: 'Documento não encontrado' }),
    ).toBeVisible()

    const shared = await createDocument(ownerPage, 'External invite')

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByLabel('Email', { exact: true }).fill(guestEmail)
    await ownerPage.getByRole('button', { name: 'Convidar' }).click()
    await expect(ownerPage.getByText('Convidado externo')).toBeVisible()

    await guestPage.goto(`/doc/${shared}`)
    await expect(
      guestPage.getByRole('heading', { name: 'External invite' }),
    ).toBeVisible()
    await expect(sidebarSection(guestPage, 'Compartilhados comigo')).toBeVisible()
    await expect(
      guestPage.getByRole('link', { name: 'Team plan' }),
    ).toHaveCount(0)

    await ownerContext.close()
    await memberContext.close()
    await guestContext.close()
  })

  test('invite link: joining by URL, the signed-out flow and revocation', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext()
    const joinerContext = await browser.newContext()
    const lateContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const joinerPage = await joinerContext.newPage()
    const latePage = await lateContext.newPage()

    await signUp(ownerPage, uniqueEmail('owner'), 'Org Owner')
    await createOrganization(ownerPage, 'Link School')

    await ownerPage.getByRole('switch', { name: 'Link de convite' }).click()
    await expect(ownerPage.getByText('Link de convite ativado')).toBeVisible()

    const inviteUrl = await ownerPage
      .getByTestId('org-invite-link')
      .inputValue()

    expect(inviteUrl).toContain('/join/')

    await signUp(joinerPage, uniqueEmail('joiner'), 'Joiner')
    await joinerPage.goto(inviteUrl)

    await expect(
      joinerPage.getByText('Você recebeu um convite para entrar em Link School'),
    ).toBeVisible()

    await joinerPage.getByTestId('join-organization').click()

    await expect(joinerPage.getByText('Você entrou na organização')).toBeVisible()
    await expect(sidebarSection(joinerPage, 'Organização')).toBeVisible()

    await joinerPage.goto('/org')
    await expect(joinerPage.getByText('2 pessoas').first()).toBeVisible()

    await latePage.goto(inviteUrl)

    await expect(
      latePage.getByText('Você recebeu um convite para entrar em Link School'),
    ).toBeVisible()
    await expect(latePage.getByRole('link', { name: 'Entrar' })).toBeVisible()

    await signUp(latePage, uniqueEmail('latecomer'), 'Latecomer')

    await latePage.waitForURL(/\/join\//)
    await latePage.getByTestId('join-organization').click()
    await expect(latePage.getByText('Você entrou na organização')).toBeVisible()
    await expect(sidebarSection(latePage, 'Organização')).toBeVisible()

    await ownerPage.reload()
    await ownerPage.getByRole('switch', { name: 'Link de convite' }).click()
    await ownerPage
      .getByRole('button', { name: 'Desativar', exact: true })
      .click()
    await expect(ownerPage.getByText('Link de convite desativado')).toBeVisible()

    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()

    await anonPage.goto(inviteUrl)
    await expect(
      anonPage.getByText('Link de convite inválido'),
    ).toBeVisible()

    await ownerContext.close()
    await joinerContext.close()
    await lateContext.close()
    await anonContext.close()
  })

  test('deleting a teamspace with a document and deleting the organization', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('owner'), 'Owner')
    await createOrganization(page, 'Disposable Org')

    await page.getByRole('button', { name: 'Criar teamspace' }).first().click()
    await page.getByLabel('Nome do teamspace').fill('Passing Team')
    await page.getByRole('button', { name: 'Criar teamspace' }).last().click()
    await expect(page.getByText('Teamspace criado')).toBeVisible()

    await page.goto('/')
    await createDocument(page, 'Document in the teamspace')
    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para teamspace' }).click()
    await page.getByRole('radio', { name: /Passing Team/ }).click()
    await page.getByRole('button', { name: 'Mover', exact: true }).click()
    await expect(page.getByText('Documento movido')).toBeVisible()

    await page.goto('/org')
    await page
      .getByRole('button', { name: 'Excluir teamspace', exact: true })
      .first()
      .click()
    await expect(
      page.getByText('O 1 documento deste teamspace volta para a organização.'),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Excluir teamspace', exact: true })
      .last()
      .click()
    await expect(page.getByText('Teamspace excluído')).toBeVisible()
    await expect(page.getByText('Passing Team')).toHaveCount(0)

    await page.getByTestId('delete-org').click()
    await page.getByTestId('confirm-delete-org').click()
    await expect(page.getByText('Organização excluída')).toBeVisible()
    await expect(page.getByLabel('Nome da organização')).toBeVisible()

    await page.goto('/')
    await expect(
      page.getByText('Document in the teamspace').first(),
    ).toBeVisible()
  })

  test('org management: role, removal and leaving', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const memberContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const memberPage = await memberContext.newPage()

    const memberEmail = uniqueEmail('management')

    await signUp(ownerPage, uniqueEmail('manager'), 'Manager')
    await createOrganization(ownerPage, 'Management School')
    await inviteToOrganization(ownerPage, memberEmail)

    await expect(
      ownerPage.getByRole('heading', { name: 'Convites pendentes' }),
    ).toBeVisible()

    await signUp(memberPage, memberEmail, 'Member Person')
    await memberPage.goto('/org')
    await expect(
      memberPage.getByRole('main').getByText('Management School'),
    ).toBeVisible()
    await expect(memberPage.getByTestId('org-switcher')).toContainText(
      'Management School',
    )
    await expect(
      memberPage.getByRole('heading', { name: 'Convidar pessoa' }),
    ).toHaveCount(0)

    await ownerPage.goto('/org')
    await expect(ownerPage.getByText('Nenhum convite pendente')).toBeVisible()

    await ownerPage
      .getByRole('combobox', { name: 'Papel de Member Person' })
      .click()
    await ownerPage.getByRole('option', { name: 'Admin' }).click()
    await expect(ownerPage.getByText('Papel atualizado')).toBeVisible()

    await memberPage.reload()
    await expect(
      memberPage.getByRole('heading', { name: 'Convidar pessoa' }),
    ).toBeVisible()

    await memberPage.getByRole('button', { name: 'Sair da organização' }).click()
    await memberPage.getByRole('button', { name: 'Sair agora' }).click()
    await expect(
      memberPage.getByRole('heading', { name: 'Criar organização' }),
    ).toBeVisible()

    await ownerPage.goto('/org')
    await expect(ownerPage.getByText('1 pessoa')).toBeVisible()

    await ownerContext.close()
    await memberContext.close()
  })

  test('the organization logo shows in the switcher and on the invite link', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('logo'), 'Logo Owner')
    await createOrganization(page, 'Logo School')

    const switcher = page.getByTestId('org-switcher')
    const logoButton = page.getByTestId('org-icon-button')
    const picker = page.getByRole('dialog', { name: 'Logo da organização' })

    await expect(logoButton).toHaveAttribute('aria-label', 'Adicionar logo')

    await logoButton.click()
    await expect(picker).toBeVisible()
    await picker.locator('[data-emoji="🌳"]').click()

    await expect(picker).toBeHidden()
    await expect(logoButton).toContainText('🌳')
    await expect(switcher).toContainText('🌳')

    await page.reload()
    await expect(switcher).toContainText('🌳')
    await expect(logoButton).toHaveAttribute('aria-label', 'Trocar o logo')

    await page.getByRole('switch', { name: 'Link de convite' }).click()
    await expect(page.getByText('Link de convite ativado')).toBeVisible()

    const inviteUrl = await page.getByTestId('org-invite-link').inputValue()

    await page.goto(inviteUrl)
    await expect(page.getByTestId('join-organization')).toBeVisible()
    await expect(page.getByText('🌳').first()).toBeVisible()

    await page.goto('/org')
    await logoButton.click()
    await picker.getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText('Logo removido')).toBeVisible()
    await expect(logoButton).toContainText('L')
    await expect(switcher).not.toContainText('🌳')
  })
})
