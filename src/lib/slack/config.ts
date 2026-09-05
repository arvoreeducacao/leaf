export const SLACK_TIMEOUT_MS = 5_000

export const SLACK_SIGNATURE_WINDOW_SECONDS = 300

const CHANNEL_ID = /^[CGD][A-Z0-9]{1,30}$/

const ARCHIVE_LINK = /^https:\/\/[a-z0-9-]+\.slack\.com\/archives\/([CGD][A-Z0-9]{1,30})/i

function trimmed(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export function slackBotToken(): string | null {
  const token = trimmed('SLACK_BOT_TOKEN')

  return token.length > 0 ? token : null
}

export function slackSigningSecret(): string | null {
  const secret = trimmed('SLACK_SIGNING_SECRET')

  return secret.length > 0 ? secret : null
}

export function isSlackBotConfigured(): boolean {
  return slackBotToken() !== null
}

export function parseChannelRef(input: string): string | null {
  const candidate = input.trim()

  if (CHANNEL_ID.test(candidate)) {
    return candidate
  }

  const link = ARCHIVE_LINK.exec(candidate)

  return link ? link[1].toUpperCase() : null
}
