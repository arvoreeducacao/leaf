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
