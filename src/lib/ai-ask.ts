import type { DocumentPassage } from '@/lib/search-index'

export const askQuestionMinLength = 3
export const askQuestionMaxLength = 500
export const askPassageMaxChars = 1_500

export type AskSource = Readonly<{
  id: string
  title: string
  excerpt: string
}>

export const askSystemPrompt = [
  'You answer questions about the documents of a Leaf workspace.',
  'Use only the excerpts given to you: they are the documents this person is allowed to read.',
  'Always answer in the language of the question.',
  'Cite the documents you used as [1], [2], matching the numbers in the excerpts, right after the sentence they support.',
  'When the excerpts do not answer the question, say so plainly in one sentence instead of guessing.',
  'Be brief: a short paragraph, or a few short lines when the answer is a list.',
  'Write plain text: no markdown, no headings, no asterisks around words.',
].join(' ')

export function readAskQuestion(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const question = value.trim().replace(/\s+/gu, ' ')

  if (
    question.length < askQuestionMinLength ||
    question.length > askQuestionMaxLength
  ) {
    return null
  }

  return question
}

function firstHit(body: string, tokens: ReadonlyArray<string>) {
  const haystack = body.toLowerCase()

  for (const token of tokens) {
    const position = haystack.indexOf(token.toLowerCase())

    if (position !== -1) {
      return position
    }
  }

  return -1
}

export function extractPassage(
  body: string,
  tokens: ReadonlyArray<string>,
  maxChars: number = askPassageMaxChars,
): string {
  const text = body.replace(/\s+/gu, ' ').trim()

  if (text.length <= maxChars) {
    return text
  }

  const hit = firstHit(text, tokens)
  const lead = Math.floor(maxChars / 4)
  const start = hit === -1 ? 0 : Math.max(0, hit - lead)
  const end = Math.min(text.length, start + maxChars)
  const slice = text.slice(start, end).trim()

  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`
}

export function toAskSources(
  passages: ReadonlyArray<DocumentPassage>,
  tokens: ReadonlyArray<string>,
): Array<AskSource> {
  return passages.map((passage) => ({
    id: passage.id,
    title: passage.title,
    excerpt: extractPassage(passage.body, tokens),
  }))
}

export function buildAskContext(sources: ReadonlyArray<AskSource>): string {
  return sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\n${source.excerpt.length > 0 ? source.excerpt : '(empty document)'}`,
    )
    .join('\n\n')
}

export type AnswerSegment = Readonly<{ text: string; strong: boolean }>

export function answerSegments(answer: string): Array<AnswerSegment> {
  const segments: Array<AnswerSegment> = []
  const pattern = /\*\*(.+?)\*\*/gsu
  let cursor = 0

  for (const match of answer.matchAll(pattern)) {
    const start = match.index ?? 0

    if (start > cursor) {
      segments.push({ text: answer.slice(cursor, start), strong: false })
    }

    segments.push({ text: match[1], strong: true })
    cursor = start + match[0].length
  }

  if (cursor < answer.length) {
    segments.push({ text: answer.slice(cursor), strong: false })
  }

  return segments
}
