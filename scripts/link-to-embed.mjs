import mysql from 'mysql2/promise'

import { convertLegacyLinkBlocks } from '../src/components/editor/embed-legacy-links.ts'

const apply = process.argv.includes('--apply')
const batchSize = 200

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL)
  const hosts = new Map()
  let cursor = ''
  let scanned = 0
  let documents = 0
  let embeds = 0

  for (;;) {
    const [rows] = await connection.query(
      'select id, content from documents where deleted_at is null and id > ? and content is not null order by id limit ?',
      [cursor, batchSize],
    )

    if (rows.length === 0) {
      break
    }

    cursor = rows[rows.length - 1].id
    scanned += rows.length

    for (const row of rows) {
      let parsed

      try {
        parsed = JSON.parse(row.content)
      } catch {
        continue
      }

      const result = convertLegacyLinkBlocks(parsed)

      if (result.changed === 0) {
        continue
      }

      documents += 1
      embeds += result.changed

      for (const block of JSON.stringify(result.blocks).matchAll(
        /"url":"https?:\/\/([^/"]+)/gu,
      )) {
        hosts.set(block[1], (hosts.get(block[1]) ?? 0) + 1)
      }

      if (apply) {
        await connection.query(
          'update documents set content = ?, updated_at = now(3) where id = ?',
          [JSON.stringify(result.blocks), row.id],
        )
      }
    }

    process.stdout.write(
      `scanned ${scanned} documents, ${documents} with embeds\n`,
    )
  }

  await connection.end()

  process.stdout.write(
    `${apply ? 'converted' : 'would convert'} ${embeds} links into embeds across ${documents} documents\n`,
  )

  for (const [host, count] of [...hosts].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${host}: ${count}\n`)
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
})
