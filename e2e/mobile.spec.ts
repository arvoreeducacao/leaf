import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  expectNoHorizontalOverflow,
  signUp,
  typeInEditor,
  uniqueEmail,
} from './helpers'

test.describe('mobile 375px', () => {
  test('the navigation becomes a Sheet and the editor fits the screen', async ({ page }) => {
    await signUp(page, uniqueEmail('mobile'))
    await createDocument(page, 'Document on the phone')

    await expect(page.getByRole('complementary', { name: 'Navegação' })).toBeHidden()

    await page.getByRole('button', { name: 'Abrir navegação' }).click()

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav).toBeVisible()
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Buscar em tudo/ }),
    ).toBeVisible()

    await page.keyboard.press('Escape')

    await typeInEditor(page, 'text written on the phone with a longer sentence')

    await expectNoHorizontalOverflow(page)
    await expect(editorBody(page)).toContainText('text written on the phone')
  })

  test('creating and managing the organization fits the screen', async ({ page }) => {
    await signUp(page, uniqueEmail('mobile-org'))

    await page.goto('/org')
    await page.getByLabel('Nome da organização').fill('School on the phone')
    await page.getByRole('button', { name: 'Criar organização' }).click()

    await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByLabel('Email', { exact: true }).fill('guest@example.test')
    await page.getByRole('button', { name: 'Convidar', exact: true }).click()

    await expect(page.getByText('guest@example.test')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('the version history fits the screen and comes back from the preview', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-versions'))
    await createDocument(page, 'Versioned document on the phone')

    await typeInEditor(page, 'first paragraph from the phone')
    await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Histórico de versões' }).click()

    const dialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Histórico de versões' })

    await expect(dialog).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await dialog
      .getByRole('list', { name: 'Versões salvas' })
      .getByRole('listitem')
      .first()
      .getByRole('button')
      .click()

    await expect(
      dialog.getByRole('region', { name: 'Conteúdo da versão' }),
    ).toContainText('first paragraph from the phone')
    await expect(
      dialog.getByRole('list', { name: 'Versões salvas' }),
    ).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    await dialog.getByRole('button', { name: 'Voltar para a lista' }).click()

    await expect(
      dialog.getByRole('list', { name: 'Versões salvas' }).getByRole('listitem'),
    ).toHaveCount(1)
  })

  test('sharing opens as a Sheet and the delete dialog becomes a bottom sheet', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-share'))
    await createDocument(page, 'Document to delete')

    await page.getByRole('button', { name: 'Compartilhar' }).click()

    const sheet = page.getByRole('dialog')

    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Com acesso')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()

    await expect(page.getByText('Documento movido para a lixeira')).toBeVisible()
    await page.waitForURL((url) => url.pathname === '/')

    await page.getByRole('button', { name: 'Abrir navegação' }).click()

    const trash = page.getByRole('button', { name: /Lixeira/ })

    await expect(trash).toBeVisible()
    await trash.click()
    await page
      .getByRole('button', { name: /Excluir .* de vez/ })
      .first()
      .click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Excluir de vez' })

    await expect(dialog).toBeVisible()

    const shape = await dialog.evaluate((element) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()

      return {
        bottomGap: window.innerHeight - rect.bottom,
        left: rect.left,
        radiusBottom: Number.parseFloat(style.borderBottomLeftRadius),
        radiusTop: Number.parseFloat(style.borderTopLeftRadius),
        widthGap: window.innerWidth - rect.width,
      }
    })

    expect(shape.left).toBeLessThanOrEqual(2)
    expect(shape.bottomGap).toBeLessThanOrEqual(2)
    expect(shape.widthGap).toBeLessThanOrEqual(16)
    expect(shape.radiusTop).toBeGreaterThan(0)
    expect(shape.radiusBottom).toBe(0)

    await expectNoHorizontalOverflow(page)
  })
  test('the command palette fits the screen and opens the document it found', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-palette'))

    const target = await createDocument(page, 'Council agenda')

    await typeInEditor(page, 'we agreed on the calendar of the meetings')
    await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await page.getByRole('button', { name: /Buscar em tudo/ }).first().click()

    const overlay = page.getByTestId('command-palette')

    await expect(overlay).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByTestId('command-palette-input').fill('calendar')

    const hit = overlay.getByRole('option', { name: /Council agenda/ })

    await expect(hit).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await hit.click()

    await page.waitForURL(`**/doc/${target}`)
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Council agenda',
    )
  })

  test('the comments panel becomes a bottom sheet and does not overflow the screen', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('comment-mobile'))
    await createDocument(page, 'Comments on the phone')

    await typeInEditor(page, 'text to comment on the phone')
    await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByTestId('comments-button').click()

    const panel = page.getByTestId('comments-panel')

    await expect(panel).toBeVisible()

    const shape = await panel.evaluate((element) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()

      return {
        bottomGap: window.innerHeight - rect.bottom,
        left: rect.left,
        radiusBottom: Number.parseFloat(style.borderBottomLeftRadius),
        radiusTop: Number.parseFloat(style.borderTopLeftRadius),
        widthGap: window.innerWidth - rect.width,
      }
    })

    expect(shape.left).toBeLessThanOrEqual(2)
    expect(shape.bottomGap).toBeLessThanOrEqual(2)
    expect(shape.widthGap).toBeLessThanOrEqual(16)
    expect(shape.radiusTop).toBeGreaterThan(0)
    expect(shape.radiusBottom).toBe(0)

    await page.getByLabel('Novo comentário').fill('Comment from the phone')
    await page.getByTestId('submit-comment').click()

    await expect(page.getByText('Comentário adicionado').first()).toBeVisible()
    await expect(
      page.getByTestId('comment-thread').first(),
    ).toContainText('Comment from the phone')

    await expectNoHorizontalOverflow(page)
  })

  test('the icon picker becomes a bottom sheet and sets the icon', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('icon-mobile'))
    await createDocument(page, 'Icon on the phone')

    await page.getByRole('button', { name: 'Adicionar ícone' }).click()

    const sheet = page.getByRole('dialog', { name: 'Ícone da página' })

    await expect(sheet).toBeVisible()

    const shape = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect()

      return {
        bottomGap: window.innerHeight - rect.bottom,
        left: rect.left,
        widthGap: window.innerWidth - rect.width,
      }
    })

    expect(shape.left).toBeLessThanOrEqual(2)
    expect(shape.bottomGap).toBeLessThanOrEqual(2)
    expect(shape.widthGap).toBeLessThanOrEqual(2)

    await sheet.locator('[data-emoji="📝"]').click()

    await expect(sheet).toBeHidden()
    await expect(page.getByTestId('document-icon-button')).toContainText('📝')

    await expectNoHorizontalOverflow(page)
  })
})

test.describe('mobile 320px', () => {
  test.use({ viewport: { width: 320, height: 780 } })

  test('the document header with badges and actions fits the screen', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-320'))

    await page.goto('/org')
    await page.getByLabel('Nome da organização').fill('Narrow School')
    await page.getByRole('button', { name: 'Criar organização' }).click()
    await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible()

    await page.getByRole('button', { name: 'Criar teamspace' }).first().click()
    await page.getByLabel('Nome do teamspace').fill('Content Team')
    await page.getByRole('button', { name: 'Criar teamspace' }).last().click()
    await expect(page.getByText('Teamspace criado')).toBeVisible()

    await page.goto('/')
    await createDocument(page, 'Document with a full header')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para teamspace' }).click()
    await page.getByRole('radio', { name: /Content Team/ }).click()
    await page.getByRole('button', { name: 'Mover', exact: true }).click()
    await expect(page.getByText('Documento movido')).toBeVisible()

    await page.getByRole('button', { name: 'Compartilhar' }).click()
    await page.getByRole('combobox', { name: 'Acesso da organização' }).click()
    await page.getByRole('option', { name: 'Pode ver' }).click()
    await expect(page.getByText('Acesso da organização atualizado')).toBeVisible()
    await page.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('document-teamspace-tag')).toBeVisible()
    await expect(page.getByTestId('document-org-tag')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    await expect(page.getByTestId('comments-button')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ações do documento' })).toBeVisible()
  })
})
