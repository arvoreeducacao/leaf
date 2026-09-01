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

test.describe('organizações', () => {
  test('privado por padrão, org_access libera leitura e depois edição', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext()
    const memberContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const memberPage = await memberContext.newPage()
    const guestPage = await guestContext.newPage()

    const memberEmail = uniqueEmail('membro')
    const guestEmail = uniqueEmail('externo')

    await signUp(ownerPage, uniqueEmail('dona'), 'Dona da Org')
    await createOrganization(ownerPage, 'Escola Teste')
    await inviteToOrganization(ownerPage, memberEmail)

    await signUp(memberPage, memberEmail, 'Membro')
    await expect(sidebarSection(memberPage, 'Organização')).toBeVisible()

    const id = await createDocument(ownerPage, 'Plano da equipe')
    await typeInEditor(ownerPage, 'conteúdo da equipe')
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
      memberPage.getByRole('link', { name: 'Plano da equipe' }),
    ).toHaveCount(0)

    await ownerPage.goto(`/doc/${id}`)
    await setOrganizationAccess(ownerPage, 'Pode ver')
    await expect(ownerPage.getByTestId('document-org-tag')).toBeVisible()

    await memberPage.goto(`/doc/${id}`)
    await expect(memberPage.getByText('Somente leitura')).toBeVisible()
    await expect(editorBody(memberPage)).toHaveCount(0)
    await expect(
      memberPage.getByRole('link', { name: 'Plano da equipe' }),
    ).toBeVisible()

    await ownerPage.goto(`/doc/${id}`)
    await setOrganizationAccess(ownerPage, 'Pode editar')

    await memberPage.goto(`/doc/${id}`)
    await expect(memberPage.getByText('Somente leitura')).toHaveCount(0)
    await typeInEditor(memberPage, ' editado pelo membro')
    await waitForSaved(memberPage)

    await signUp(guestPage, guestEmail, 'Externo')
    await expect(sidebarSection(guestPage, 'Organização')).toHaveCount(0)

    await guestPage.goto(`/doc/${id}`)
    await expect(
      guestPage.getByRole('heading', { name: 'Documento não encontrado' }),
    ).toBeVisible()

    const shared = await createDocument(ownerPage, 'Convite externo')

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByLabel('Email', { exact: true }).fill(guestEmail)
    await ownerPage.getByRole('button', { name: 'Convidar' }).click()
    await expect(ownerPage.getByText('Convidado externo')).toBeVisible()

    await guestPage.goto(`/doc/${shared}`)
    await expect(
      guestPage.getByRole('heading', { name: 'Convite externo' }),
    ).toBeVisible()
    await expect(sidebarSection(guestPage, 'Compartilhados comigo')).toBeVisible()
    await expect(
      guestPage.getByRole('link', { name: 'Plano da equipe' }),
    ).toHaveCount(0)

    await ownerContext.close()
    await memberContext.close()
    await guestContext.close()
  })

  test('link de convite: entrar pela URL, fluxo deslogado e revogação', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext()
    const joinerContext = await browser.newContext()
    const lateContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const joinerPage = await joinerContext.newPage()
    const latePage = await lateContext.newPage()

    await signUp(ownerPage, uniqueEmail('dona'), 'Dona da Org')
    await createOrganization(ownerPage, 'Escola do Link')

    await ownerPage.getByRole('switch', { name: 'Link de convite' }).click()
    await expect(ownerPage.getByText('Link de convite ativado')).toBeVisible()

    const inviteUrl = await ownerPage
      .getByTestId('org-invite-link')
      .inputValue()

    expect(inviteUrl).toContain('/join/')

    await signUp(joinerPage, uniqueEmail('entrante'), 'Entrante')
    await joinerPage.goto(inviteUrl)

    await expect(
      joinerPage.getByText('Você recebeu um convite para entrar em Escola do Link'),
    ).toBeVisible()

    await joinerPage.getByTestId('join-organization').click()

    await expect(joinerPage.getByText('Você entrou na organização')).toBeVisible()
    await expect(sidebarSection(joinerPage, 'Organização')).toBeVisible()

    await joinerPage.goto('/org')
    await expect(joinerPage.getByText('2 pessoas').first()).toBeVisible()

    await latePage.goto(inviteUrl)

    await expect(
      latePage.getByText('Você recebeu um convite para entrar em Escola do Link'),
    ).toBeVisible()
    await expect(latePage.getByRole('link', { name: 'Entrar' })).toBeVisible()

    await signUp(latePage, uniqueEmail('atrasada'), 'Atrasada')

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

  test('gestão da org: papel, remoção e saída', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const memberContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const memberPage = await memberContext.newPage()

    const memberEmail = uniqueEmail('gestao')

    await signUp(ownerPage, uniqueEmail('gestora'), 'Gestora')
    await createOrganization(ownerPage, 'Escola Gestão')
    await inviteToOrganization(ownerPage, memberEmail)

    await expect(
      ownerPage.getByRole('heading', { name: 'Convites pendentes' }),
    ).toBeVisible()

    await signUp(memberPage, memberEmail, 'Pessoa Membro')
    await memberPage.goto('/org')
    await expect(
      memberPage.getByRole('main').getByText('Escola Gestão'),
    ).toBeVisible()
    await expect(memberPage.getByTestId('org-switcher')).toContainText(
      'Escola Gestão',
    )
    await expect(
      memberPage.getByRole('heading', { name: 'Convidar pessoa' }),
    ).toHaveCount(0)

    await ownerPage.goto('/org')
    await expect(ownerPage.getByText('Nenhum convite pendente')).toBeVisible()

    await ownerPage
      .getByRole('combobox', { name: 'Papel de Pessoa Membro' })
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
})
