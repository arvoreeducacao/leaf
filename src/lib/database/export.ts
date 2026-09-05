import {
  getDatabaseDocument,
  listDatabaseProperties,
  listDatabaseRows,
} from '@/lib/databases'
import { markdownToBlocks } from '@/lib/markdown/convert'

import { parseUniqueIdConfig } from './unique-id'
import { parseOptions, valueOf, valueToText } from './values'

function escapeCell(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()
}

function line(cells: ReadonlyArray<string>): string {
  return `| ${cells.map(escapeCell).join(' | ')} |`
}

export async function databaseToMarkdown(
  databaseId: string,
  titleColumn: string,
  emptyTitle: string,
  locale: string,
): Promise<string | null> {
  const database = await getDatabaseDocument(databaseId)

  if (!database) {
    return null
  }

  const [properties, rows] = await Promise.all([
    listDatabaseProperties(databaseId),
    listDatabaseRows(databaseId),
  ])

  const header = [titleColumn, ...properties.map((property) => property.name)]
  const separator = `| ${header.map(() => '---').join(' | ')} |`

  const body = rows.map((row) =>
    line([
      row.title.trim().length > 0 ? row.title : emptyTitle,
      ...properties.map((property) => {
        const options = parseOptions(property.options)

        return valueToText(
          valueOf(row.values, property, options),
          property.type,
          options,
          locale,
          parseUniqueIdConfig(property.options).prefix,
        )
      }),
    ]),
  )

  return [line(header), separator, ...body].join('\n')
}

type BlockLike = Readonly<{
  type?: string
  props?: Readonly<{ databaseId?: string }>
  children?: unknown
}>

export async function expandDatabaseBlocks(
  blocks: ReadonlyArray<unknown>,
  titleColumn: string,
  emptyTitle: string,
  locale: string,
): Promise<Array<unknown>> {
  const expanded: Array<unknown> = []

  for (const item of blocks) {
    if (!item || typeof item !== 'object') {
      expanded.push(item)
      continue
    }

    const block = item as BlockLike

    if (block.type === 'database') {
      const databaseId = block.props?.databaseId ?? ''
      const markdown = databaseId
        ? await databaseToMarkdown(databaseId, titleColumn, emptyTitle, locale)
        : null

      if (markdown) {
        expanded.push(...(await markdownToBlocks(markdown)))
      }

      continue
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      expanded.push({
        ...block,
        children: await expandDatabaseBlocks(
          block.children,
          titleColumn,
          emptyTitle,
          locale,
        ),
      })

      continue
    }

    expanded.push(item)
  }

  return expanded
}
