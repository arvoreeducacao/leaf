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
})
