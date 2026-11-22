const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const uploadsRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

function s3Settings() {
  const bucket = process.env.S3_BUCKET || '';
  const region = process.env.AWS_REGION || 'ap-southeast-1';
  const prefix = String(process.env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
  return { bucket, region, prefix };
}

let client;
function s3Client() {
  if (!client) {
    const { region } = s3Settings();
    client = new S3Client({
      region,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }
  return client;
}

function isS3Configured() {
  return Boolean(s3Settings().bucket);
}

function normalizeKey(storedPath) {
  return String(storedPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function buildS3Key(relativePath) {
  const normalized = normalizeKey(relativePath);
  const { prefix } = s3Settings();
  return prefix ? `${prefix}/${normalized}` : normalized;
}

function localPathFor(storedPath) {
  const relative = normalizeKey(storedPath);
  const full = path.resolve(uploadsRoot, relative);
  const root = uploadsRoot.endsWith(path.sep) ? uploadsRoot : uploadsRoot + path.sep;
  if (full !== uploadsRoot && !full.startsWith(root)) {
    const err = new Error('Invalid file path');
    err.status = 400;
    throw err;
  }
  return full;
}

function isLocalPath(storedPath) {
  if (!storedPath) return false;
  try {
    return fs.existsSync(localPathFor(storedPath));
  } catch {
    return false;
  }
}

function contentDisposition(fileName, inline) {
  const safe = String(fileName || 'file').replace(/[\r\n"]/g, '');
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"`;
}

async function uploadBuffer(relativePath, buffer, contentType) {
  const normalized = normalizeKey(relativePath);
  if (!normalized) {
    const err = new Error('Invalid file path');
    err.status = 400;
    throw err;
  }
  if (!isS3Configured()) {
    const full = localPathFor(normalized);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, buffer);
    return normalized;
  }
  const { bucket } = s3Settings();
  await s3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: buildS3Key(normalized),
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }));
  return normalized;
}

async function exists(storedPath) {
  if (!storedPath) return false;
  if (isLocalPath(storedPath)) return true;
  if (!isS3Configured()) return false;
  try {
    const { bucket } = s3Settings();
    await s3Client().send(new HeadObjectCommand({
      Bucket: bucket,
      Key: buildS3Key(storedPath),
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function readBuffer(storedPath) {
  if (isLocalPath(storedPath)) {
    return fs.promises.readFile(localPathFor(storedPath));
  }
  if (!isS3Configured()) {
    const err = new Error('File not found');
    err.status = 404;
    throw err;
  }
  const { bucket } = s3Settings();
  const obj = await s3Client().send(new GetObjectCommand({
    Bucket: bucket,
    Key: buildS3Key(storedPath),
  }));
  if (obj.Body && typeof obj.Body.transformToByteArray === 'function') {
    return Buffer.from(await obj.Body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of obj.Body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function deleteFile(storedPath) {
  if (!storedPath) return;
  if (isLocalPath(storedPath)) {
    const full = localPathFor(storedPath);
    if (fs.existsSync(full)) await fs.promises.unlink(full);
    return;
  }
  if (!isS3Configured()) return;
  const { bucket } = s3Settings();
  await s3Client().send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: buildS3Key(storedPath),
  }));
}

async function streamToResponse(res, storedPath, fileName, { inline = false, contentType } = {}) {
  if (isLocalPath(storedPath)) {
    const full = localPathFor(storedPath);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(fileName, inline));
    fs.createReadStream(full).pipe(res);
    return;
  }
  if (!isS3Configured()) {
    res.status(404).json({ message: 'File not found.' });
    return;
  }
  try {
    const { bucket } = s3Settings();
    const obj = await s3Client().send(new GetObjectCommand({
      Bucket: bucket,
      Key: buildS3Key(storedPath),
    }));
    res.setHeader('Content-Type', contentType || obj.ContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(fileName, inline));
    if (obj.ContentLength != null) res.setHeader('Content-Length', String(obj.ContentLength));
    if (obj.Body && typeof obj.Body.pipe === 'function') {
      obj.Body.pipe(res);
      return;
    }
    const bytes = obj.Body && typeof obj.Body.transformToByteArray === 'function'
      ? Buffer.from(await obj.Body.transformToByteArray())
      : Buffer.alloc(0);
    res.end(bytes);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }
    console.error('[eProcess] S3 read failed:', err.message);
    if (!res.headersSent) res.status(500).json({ message: 'Unable to read the file.' });
  }
}

module.exports = {
  uploadsRoot,
  isS3Configured,
  uploadBuffer,
  exists,
  readBuffer,
  deleteFile,
  streamToResponse,
};
