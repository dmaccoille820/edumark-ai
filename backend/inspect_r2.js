import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const r2AccountId = (process.env.R2_ACCOUNT_ID || '').replace(/["']/g, '');
const r2BucketName = (process.env.R2_BUCKET_NAME || 'edumark').replace(/["']/g, '');
const r2AccessKeyId = (process.env.R2_ACCESS_KEY_ID || '').replace(/["']/g, '');
const r2SecretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').replace(/["']/g, '');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

async function check() {
  const list = await r2Client.send(new ListObjectsV2Command({ Bucket: r2BucketName }));
  console.log('Total objects in R2:', list.Contents ? list.Contents.length : 0);
  for (const item of (list.Contents || [])) {
    console.log('--- Key:', item.Key, 'Size:', item.Size, 'LastModified:', item.LastModified);
    const obj = await r2Client.send(new GetObjectCommand({ Bucket: r2BucketName, Key: item.Key }));
    const bytes = await obj.Body.transformToByteArray();
    const slice = Buffer.from(bytes.slice(0, 200));
    console.log('  ContentType:', obj.ContentType);
    console.log('  Hex (first 16):', slice.slice(0, 16).toString('hex'));
    console.log('  Text Preview:', slice.toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
  }
}
check().catch(console.error);
