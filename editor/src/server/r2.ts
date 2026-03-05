import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { EditorEnv } from './env'

const CACHE_CONTROL = 'public,max-age=31536000,immutable'

let s3: S3Client
let bucketName: string

export function initR2(env: EditorEnv) {
  bucketName = env.R2_BUCKET_NAME
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
}

export async function uploadToR2(slug: string, buffer: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: `creatures/${slug}.webp`,
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: CACHE_CONTROL,
    }),
  )
}

export async function deleteFromR2(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}

export async function listR2Keys(): Promise<Array<string>> {
  const keys: Array<string> = []
  let continuationToken: string | undefined

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'creatures/',
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.NextContinuationToken
  } while (continuationToken)

  return keys
}
