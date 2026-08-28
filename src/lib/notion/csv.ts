import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '@/lib/notion/limits'

export function parseCsv(text: string): Array<Array<string>> {
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let field = ''
  let quoted = false
  let index = 0

  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')

  function endField() {
    row.push(field)
    field = ''
  }

  function endRow() {
    endField()
    rows.push(row)
    row = []
  }

  while (index < source.length) {
    const char = source[index]

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }

        quoted = false
        index += 1
        continue
      }

      field += char
      index += 1
      continue
    }

    if (char === '"') {
      quoted = true
      index += 1
      continue
    }

    if (char === ',') {
      endField()
      index += 1
      continue
    }

    if (char === '\n') {
      endRow()
      index += 1
      continue
    }

    field += char
    index += 1
  }

  if (field.length > 0 || row.length > 0) {
    endRow()
  }

  return rows.filter(
    (item) => item.length > 1 || (item[0] ?? '').trim().length > 0,
  )
}

function escapeCell(value: string) {
  return value
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

export type CsvTable = Readonly<{
  markdown: string
  columns: number
  rows: number
  truncatedColumns: boolean
  truncatedRows: boolean
}>

export function csvToMarkdownTable(text: string): CsvTable | null {
  const rows = parseCsv(text)

  if (rows.length === 0) {
    return null
  }

  const totalColumns = Math.max(...rows.map((row) => row.length))
  const columns = Math.min(totalColumns, MAX_TABLE_COLUMNS)
  const header = rows[0]
  const body = rows.slice(1)
  const keptBody = body.slice(0, MAX_TABLE_ROWS)

  function line(cells: Array<string>) {
    const padded = Array.from({ length: columns }, (_, index) =>
      escapeCell(cells[index] ?? ''),
    )

    return `| ${padded.join(' | ')} |`
  }

  const separator = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`

  const markdown = [
    line(header),
    separator,
    ...keptBody.map((row) => line(row)),
  ].join('\n')

  return {
    markdown,
    columns,
    rows: keptBody.length,
    truncatedColumns: totalColumns > columns,
    truncatedRows: body.length > keptBody.length,
  }
}
