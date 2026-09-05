const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_API_VERSION = '2022-06-28'
const MAX_PROPERTY_NAME = 120
const QUERY_PAGE_SIZE = 100
const REQUEST_INTERVAL = 340
const MAX_ATTEMPTS = 6
const RETRY_DELAY = 2000
const MAX_RETRY_DELAY = 30000
const UNRESOLVED_SAMPLE = 20

function connectionOptions(url) {
  const parsed = new URL(url)

  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    charset: 'UTF8MB4_UNICODE_CI',
    dateStrings: true,
    timezone: 'Z',
    supportBigNumbers: true,
  }
}

function readConfig(argv) {
  const database = argv.find((value) => value.startsWith('--database='))

  return {
    apply: argv.includes('--apply'),
    databaseId: database ? database.split('=')[1] : null,
  }
}

function normalizeNotionId(id) {
  return String(id).replace(/-/g, '').toLowerCase()
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function retryDelay(response, attempt) {
  const header = Number(response.headers.get('retry-after'))

  if (Number.isFinite(header) && header > 0) {
    return Math.min(header * 1000, MAX_RETRY_DELAY)
  }

  return Math.min(RETRY_DELAY * attempt, MAX_RETRY_DELAY)
}

function personLabels(property) {
  const people =
    property.type === 'people'
      ? (property.people ?? [])
      : property.type === 'created_by' || property.type === 'last_edited_by'
        ? [property[property.type]]
        : null

  if (people === null) {
    return null
  }

  return people
    .filter(Boolean)
    .map((person) => (person.person?.email ?? person.name ?? '').toLowerCase())
    .filter((label) => label.length > 0)
}

async function notionRequest(path, token, body) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${NOTION_API_BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 429 || response.status >= 500) {
      await sleep(retryDelay(response, attempt))
      continue
    }

    const payload = await response.json()

    if (!response.ok) {
      throw new Error(`${response.status} ${payload.code ?? 'unknown'}`)
    }

    return payload
  }

  throw new Error(`notion kept refusing ${path}`)
}

async function loadNotionToken(connection) {
  const [rows] = await connection.query(
    'select access_token as token from notion_connections order by updated_at desc limit 1',
  )

  if (rows.length === 0) {
    throw new Error('no Notion connection is saved')
  }

  return String(rows[0].token)
}

async function loadPeopleByLabel(connection) {
  const [rows] = await connection.query(
    `select u.id as id, u.email as email, u.name as name
       from user u
       join organization_members m on m.user_id = u.id`,
  )
  const byLabel = new Map()

  for (const row of rows) {
    const email = String(row.email ?? '').toLowerCase()
    const name = String(row.name ?? '').toLowerCase()

    if (email.length > 0) {
      byLabel.set(email, String(row.id))
    }

    if (name.length > 0 && !byLabel.has(name)) {
      byLabel.set(name, String(row.id))
    }
  }

  return byLabel
}

async function loadDatabases(connection, databaseId) {
  const [rows] = await connection.query(
    `select distinct d.id as id, d.title as title, nd.notion_id as notionId
       from database_properties p
       join documents d
         on d.id = p.database_id
        and d.kind = 'database'
        and d.deleted_at is null
       join notion_documents nd on nd.document_id = d.id
      where p.type = 'person'
        ${databaseId ? 'and d.id = ?' : ''}`,
    databaseId ? [databaseId] : [],
  )

  return rows.map((row) => ({
    id: String(row.id),
    notionId: String(row.notionId),
    title: String(row.title),
  }))
}

async function loadPropertyIdByName(connection, databaseId) {
  const [rows] = await connection.query(
    `select id, name from database_properties
      where database_id = ? and type = 'person'
      order by position`,
    [databaseId],
  )
  const byName = new Map()

  for (const row of rows) {
    if (!byName.has(String(row.name))) {
      byName.set(String(row.name), String(row.id))
    }
  }

  return byName
}

async function loadRowsByNotionId(connection, databaseId) {
  const [rows] = await connection.query(
    `select d.id as id, d.properties as properties, nd.notion_id as notionId
       from documents d
       join notion_documents nd on nd.document_id = d.id
      where d.parent_id = ?
        and d.kind = 'row'
        and d.deleted_at is null`,
    [databaseId],
  )

  return new Map(
    rows.map((row) => [
      normalizeNotionId(row.notionId),
      { id: String(row.id), properties: row.properties },
    ]),
  )
}

function storedValues(row) {
  if (!row.properties) {
    return {}
  }

  try {
    const parsed = JSON.parse(String(row.properties))

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function mergePeople(current, resolved) {
  const merged = Array.isArray(current) ? [...current] : []
  const added = []

  for (const id of resolved) {
    if (!merged.includes(id)) {
      merged.push(id)
      added.push(id)
    }
  }

  return { added, merged }
}

function resolveLabels(labels, context) {
  const resolved = []

  for (const label of labels) {
    const personId = context.peopleByLabel.get(label)

    if (personId) {
      resolved.push(personId)
      continue
    }

    context.unresolved.set(label, (context.unresolved.get(label) ?? 0) + 1)
  }

  return resolved
}

async function repairRow(connection, notionRow, row, propertyIdByName, context) {
  const values = storedValues(row)
  const filled = { cells: 0, mentions: 0 }

  for (const [name, property] of Object.entries(notionRow.properties ?? {})) {
    const labels = personLabels(property)

    if (labels === null || labels.length === 0) {
      continue
    }

    const propertyId =
      propertyIdByName.get(name) ??
      propertyIdByName.get(name.slice(0, MAX_PROPERTY_NAME))

    if (!propertyId) {
      continue
    }

    const current = values[propertyId]
    const { added, merged } = mergePeople(
      current,
      resolveLabels(labels, context),
    )

    if (added.length === 0) {
      continue
    }

    if (!Array.isArray(current) || current.length === 0) {
      filled.cells += 1
    }

    values[propertyId] = merged
    filled.mentions += added.length
  }

  if (filled.mentions === 0) {
    return filled
  }

  if (context.apply) {
    await connection.execute(
      'update documents set properties = ? where id = ?',
      [JSON.stringify(values), row.id],
    )
  }

  return filled
}

async function repairDatabase(connection, database, context) {
  const propertyIdByName = await loadPropertyIdByName(connection, database.id)
  const rowsByNotionId = await loadRowsByNotionId(connection, database.id)
  const totals = { cells: 0, interrupted: null, mentions: 0, rows: 0 }

  if (rowsByNotionId.size === 0) {
    return totals
  }

  let cursor

  do {
    let page

    try {
      page = await notionRequest(
        `/databases/${database.notionId}/query`,
        context.token,
        { page_size: QUERY_PAGE_SIZE, start_cursor: cursor },
      )
    } catch (error) {
      totals.interrupted = String(error.message)

      return totals
    }

    for (const notionRow of page.results ?? []) {
      const row = rowsByNotionId.get(normalizeNotionId(notionRow.id))

      if (!row) {
        continue
      }

      const filled = await repairRow(
        connection,
        notionRow,
        row,
        propertyIdByName,
        context,
      )

      if (filled.mentions === 0) {
        continue
      }

      totals.cells += filled.cells
      totals.mentions += filled.mentions
      totals.rows += 1
    }

    cursor = page.has_more ? page.next_cursor : undefined
    await sleep(REQUEST_INTERVAL)
  } while (cursor)

  return totals
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined')
  }

  const config = readConfig(process.argv)
  const mysql = (await import('mysql2/promise')).default
  const connection = await mysql.createConnection(
    connectionOptions(databaseUrl),
  )

  try {
    const context = {
      apply: config.apply,
      peopleByLabel: await loadPeopleByLabel(connection),
      token: await loadNotionToken(connection),
      unresolved: new Map(),
    }
    const databases = await loadDatabases(connection, config.databaseId)

    console.log(
      `[repair-people] ${config.apply ? 'applying' : 'dry run'} over ${databases.length} databases, ${context.peopleByLabel.size} labels in the workspace`,
    )

    const totals = { cells: 0, interrupted: 0, mentions: 0, rows: 0 }

    for (const database of databases) {
      const repaired = await repairDatabase(connection, database, context)

      totals.cells += repaired.cells
      totals.mentions += repaired.mentions
      totals.rows += repaired.rows

      if (repaired.rows > 0) {
        console.log(
          `[repair-people] ${database.title}: ${repaired.rows} rows, ${repaired.cells} cells, ${repaired.mentions} mentions`,
        )
      }

      if (repaired.interrupted) {
        totals.interrupted += 1

        console.log(
          `[repair-people] ${database.title}: stopped early, ${repaired.interrupted}`,
        )
      }
    }

    const unresolved = [...context.unresolved.entries()].sort(
      (left, right) => right[1] - left[1],
    )
    const mentionsWithoutAccount = unresolved.reduce(
      (total, [, count]) => total + count,
      0,
    )

    console.log('')
    console.log(
      `[repair-people] ${totals.rows} rows, ${totals.cells} cells, ${totals.mentions} mentions ${config.apply ? 'written' : 'ready to write'}`,
    )
    console.log(
      `[repair-people] databases stopped early: ${totals.interrupted}, run again to finish them`,
    )
    console.log(
      `[repair-people] left empty: ${mentionsWithoutAccount} mentions of ${unresolved.length} people with no Leaf account`,
    )

    for (const [label, count] of unresolved.slice(0, UNRESOLVED_SAMPLE)) {
      console.log(`[repair-people]   ${label}: ${count}`)
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
