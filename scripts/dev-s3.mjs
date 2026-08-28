import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import S3rver from 's3rver'

const port = Number(process.env.S3_PORT ?? 4568)
const bucket = process.env.S3_BUCKET ?? 'leaf-uploads'
const directory = resolve(process.cwd(), '.s3rver')

mkdirSync(directory, { recursive: true })

const server = new S3rver({
  port,
  address: '127.0.0.1',
  silent: false,
  directory,
  configureBuckets: [{ name: bucket }],
})

server.run((error) => {
  if (error) {
    console.error('[dev-s3] falha ao subir o emulador S3:', error)
    process.exit(1)
  }

  console.log(
    `[dev-s3] emulador S3 em http://127.0.0.1:${port} (bucket ${bucket})`,
  )
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
