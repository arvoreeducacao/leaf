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
  test('navegação vira Sheet e o editor cabe na tela', async ({ page }) => {
    await signUp(page, uniqueEmail('mobile'))
    await createDocument(page, 'Documento no celular')

    await expect(page.getByRole('complementary', { name: 'Navegação' })).toBeHidden()

    await page.getByRole('button', { name: 'Abrir navegação' }).click()

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav).toBeVisible()
    await expect(
      page.getByRole('dialog').getByLabel('Buscar documento pelo título'),
    ).toBeVisible()

    await page.keyboard.press('Escape')

    await typeInEditor(page, 'texto escrito no celular com uma frase mais longa')

    await expectNoHorizontalOverflow(page)
    await expect(editorBody(page)).toContainText('texto escrito no celular')
  })

  test('criar e gerir a organização cabe na tela', async ({ page }) => {
    await signUp(page, uniqueEmail('mobile-org'))

    await page.goto('/org')
    await page.getByLabel('Nome da organização').fill('Escola no celular')
    await page.getByRole('button', { name: 'Criar organização' }).click()

    await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByLabel('Email', { exact: true }).fill('convidada@exemplo.test')
    await page.getByRole('button', { name: 'Convidar', exact: true }).click()

    await expect(page.getByText('convidada@exemplo.test')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('histórico de versões cabe na tela e volta da pré-visualização', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-versoes'))
    await createDocument(page, 'Documento versionado no celular')

    await typeInEditor(page, 'primeiro paragrafo do celular')
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
    ).toContainText('primeiro paragrafo do celular')
    await expect(
      dialog.getByRole('list', { name: 'Versões salvas' }),
    ).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    await dialog.getByRole('button', { name: 'Voltar para a lista' }).click()

    await expect(
      dialog.getByRole('list', { name: 'Versões salvas' }).getByRole('listitem'),
    ).toHaveCount(1)
  })

  test('compartilhar abre como Sheet e o diálogo de excluir vira folha de baixo', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-share'))
    await createDocument(page, 'Documento a excluir')

    await page.getByRole('button', { name: 'Compartilhar' }).click()

    const sheet = page.getByRole('dialog')

    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Com acesso')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()

    await expect(page.getByText('Documento movido para a lixeira')).toBeVisible()

    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await page.getByRole('button', { name: /Lixeira/ }).click()
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
  test('command palette cabe na tela e abre o documento encontrado', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('mobile-palette'))

    const alvo = await createDocument(page, 'Pauta do conselho')

    await typeInEditor(page, 'combinamos o calendario das reunioes')
    await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await page.getByRole('button', { name: /Buscar em tudo/ }).first().click()

    const overlay = page.getByTestId('command-palette')

    await expect(overlay).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByTestId('command-palette-input').fill('calendario')

    const hit = overlay.getByRole('option', { name: /Pauta do conselho/ })

    await expect(hit).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await hit.click()

    await page.waitForURL(`**/doc/${alvo}`)
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Pauta do conselho',
    )
  })

  test('painel de comentários vira bottom sheet e não estoura a tela', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('comentario-mobile'))
    await createDocument(page, 'Comentários no celular')

    await typeInEditor(page, 'texto para comentar no celular')
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

    await page.getByLabel('Novo comentário').fill('Comentário do celular')
    await page.getByTestId('submit-comment').click()

    await expect(page.getByText('Comentário adicionado').first()).toBeVisible()
    await expect(
      page.getByTestId('comment-thread').first(),
    ).toContainText('Comentário do celular')

    await expectNoHorizontalOverflow(page)
  })
})
