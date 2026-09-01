import { expect, type Page } from '@playwright/test'

let counter = 0

export function uniqueEmail(prefix = 'leaf') {
  counter += 1

  return `${prefix}-${Date.now()}-${process.pid}-${counter}@example.test`
}

export const password = 'test-password-123'

async function submitUntilLeaves(page: Page, buttonName: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.getByRole('button', { name: buttonName }).click()

    try {
      await page.waitForURL(
        (url) => !/\/(signup|login)$/.test(url.pathname),
        { timeout: 8_000 },
      )

      return
    } catch {
      const alert = page.getByRole('alert')

      if (await alert.isVisible().catch(() => false)) {
        throw new Error(`Authentication failed: ${await alert.innerText()}`)
      }
    }
  }

  throw new Error(`Did not leave the auth screen after clicking ${buttonName}`)
}

export async function signUp(page: Page, email: string, name = 'Test Person') {
  await page.goto('/signup')
  await page.getByLabel('Nome (opcional)').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await submitUntilLeaves(page, 'Criar conta')
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await submitUntilLeaves(page, 'Entrar')
}

export async function createDocument(page: Page, title?: string) {
  const before = page.url()

  await page.getByRole('button', { name: 'Novo documento' }).first().click()
  await page.waitForURL((url) => /\/doc\/[\w-]+$/.test(url.pathname) && url.href !== before)
  await waitForEditorReady(page)

  if (title) {
    await renameDocument(page, title)
  }

  return page.url().split('/doc/')[1]
}

export async function waitForEditorReady(page: Page) {
  await expect(page.locator('.leaf-editor').first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(/(palavras?|words?)$/).first()).toBeVisible()
}

export async function renameDocument(page: Page, title: string) {
  const input = page.getByLabel('Título do documento')

  await input.click()
  await input.fill(title)
  await input.blur()
  await expect(page.getByLabel('Título do documento')).toHaveValue(title)
  await expect(page.getByLabel('Título do documento')).toBeEnabled()
}

export function editorBody(page: Page) {
  return page.locator('.leaf-editor [contenteditable="true"]').first()
}

export async function typeInEditor(page: Page, text: string) {
  const body = editorBody(page)

  await body.click()
  await page.keyboard.type(text)
}

export async function waitForSaved(page: Page) {
  await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  })
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )

  expect(overflow).toBeLessThanOrEqual(1)
}
