import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../env.js";

function createClient() {
  const endpoint = env.R2_ENDPOINT || (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

  if (!endpoint || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY
    }
  });
}

export const r2Client = createClient();

export async function putObjectToR2(key: string, body: Buffer | Uint8Array | string, contentType?: string) {
  if (!r2Client || !env.R2_BUCKET_NAME) {
    return;
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

