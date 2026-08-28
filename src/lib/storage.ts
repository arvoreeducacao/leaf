import { Readable } from 'node:stream'

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

export type StoredObject = {
  body: ReadableStream | Buffer
  contentType: string
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<StoredObject | null>
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`)
  }

  return value
}

function createS3Driver(): StorageDriver {
  let client: S3Client | null = null

  function getClient() {
    if (!client) {
      client = new S3Client({
        endpoint: requireEnv('S3_ENDPOINT'),
        region: process.env.S3_REGION ?? 'us-east-1',
        credentials: {
          accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
        },
        forcePathStyle: true,
      })
    }

    return client
  }

  return {
    async put(key, body, contentType) {
      await getClient().send(
        new PutObjectCommand({
          Bucket: requireEnv('S3_BUCKET'),
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      )
    },
    async get(key) {
      try {
        const result = await getClient().send(
          new GetObjectCommand({
            Bucket: requireEnv('S3_BUCKET'),
            Key: key,
          }),
        )

        if (!result.Body) {
          return null
        }

        const stream = result.Body as Readable
        const chunks: Array<Buffer> = []

        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk))
        }

        return {
          body: Buffer.concat(chunks),
          contentType: result.ContentType ?? 'application/octet-stream',
        }
      } catch {
        return null
      }
    },
  }
}

export const storage: StorageDriver = createS3Driver()
