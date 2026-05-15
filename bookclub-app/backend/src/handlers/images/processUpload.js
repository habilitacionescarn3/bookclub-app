const AWS = require('aws-sdk');
const Book = require('../../models/book');
const textractService = require('../../lib/textract-service');
const { DynamoDB } = require('../../lib/aws-config');
const { publishEvent } = require('../../lib/event-bus');
const { getTableName } = require('../../lib/table-names');

// Constants
const METADATA_SOURCE_PENDING = 'image-upload-pending';
const PLACEHOLDER_AUTHOR = 'Unknown Author';
const PROCESSING_DESCRIPTION = 'Book uploaded via image - metadata processing in progress';

// --- Handler ---
module.exports.handler = async (event) => {
  console.log('[ImageProcessor] Processing S3 event:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      if (!isS3Event(record)) {
        console.log('[ImageProcessor] Skipping non-S3 event');
        continue;
      }

      const { bucket, key } = parseS3Record(record);
      console.log(`[ImageProcessor] Processing image: s3://${bucket}/${key}`);

      if (!shouldProcessKey(key)) {
        console.log('[ImageProcessor] Skipping unrecognised key prefix');
        continue;
      }

      try {
        if (isLibraryKey(key)) {
          // ── Library item path ──────────────────────────────────────────
          const { libraryType, userId } = extractLibraryKeyParts(key);
          if (!userId || !libraryType) {
            console.warn(`[ImageProcessor] Could not extract libraryType/userId from key: ${key}`);
            continue;
          }
          await processLibraryUpload({ bucket, key, userId, libraryType });
        } else {
          // ── Book path ──────────────────────────────────────
          const userId = extractUserIdFromKey(key);
          if (!userId) {
            console.warn(`[ImageProcessor] Could not extract userId from key: ${key}`);
            continue;
          }
          const createdBook = await createMinimalBookEntry(bucket, key, userId);
          await publishEvent('S3.ObjectCreated', { bucket, key, userId, bookId: createdBook.bookId, eventType: 'book-cover-uploaded' });
          console.log(`[ImageProcessor] Published S3.ObjectCreated event for book: ${createdBook.bookId}`);
          
          const queueUrl = process.env.BEDROCK_ANALYZE_QUEUE_URL;
          if (queueUrl) {
            await enqueueBedrockAnalyze({ bucket, key, bookId: createdBook.bookId })
              .catch(err => console.warn('[ImageProcessor] Enqueue to BedrockAnalyzeQueue failed:', err.message));
          } else {
            await invokeBedrockAnalyzer({ bucket, key, bookId: createdBook.bookId })
              .catch(err => console.warn('[ImageProcessor] Bedrock analyzer direct invoke failed:', err.message));
          }
        }
      } catch (itemError) {
        console.error(`[ImageProcessor] Error processing ${key}:`, itemError);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Processed ${event.Records.length} image(s)` }),
    };
  } catch (error) {
    console.error('[ImageProcessor] Error processing S3 event:', error);
    throw error;
  }
};

async function enqueueBedrockAnalyze({ bucket, key, bookId, listingId, libraryType }) {
  const queueUrl = process.env.BEDROCK_ANALYZE_QUEUE_URL;
  if (!queueUrl) throw new Error('BEDROCK_ANALYZE_QUEUE_URL not set');
  const sqs = new AWS.SQS();
  const payload = { bucket, key, bookId, listingId, libraryType, contentType: 'image/jpeg' };
  await sqs.sendMessage({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
  }).promise();
  console.log('[ImageProcessor] Enqueued Bedrock analyze message for', key);
}

/**
 * Derives a meaningful title from the uploaded filename
 */
function deriveBookTitleFromFilename(s3Key) {
  const keyParts = s3Key.split('/');
  const filename = keyParts[keyParts.length - 1];
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return nameWithoutExt
    .replace(/[_\-\.]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim() || 'Uploaded Item';
}

const isS3Event = (record) => record?.eventSource === 'aws:s3';

const parseS3Record = (record) => ({
  bucket: record.s3.bucket.name,
  key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
});

const isLibraryKey = (key) => key && key.startsWith('library-images/');
const shouldProcessKey = (key) => key && (key.startsWith('book-covers/') || isLibraryKey(key));

const extractUserIdFromKey = (key) => {
  const parts = key.split('/');
  if (parts.length < 3) return null;
  return parts[1];
};

const extractLibraryKeyParts = (key) => {
  const parts = key.split('/');
  if (parts.length < 4) return { libraryType: null, userId: null };
  return { libraryType: parts[1], userId: parts[2] };
};

// ── Library item helpers ───────────────────────────────────────────────────────

async function getMappedBookId(bucket, key) {
  try {
    const dynamodb = new DynamoDB.DocumentClient();
    const cacheKey = `bookForS3:${bucket}:${key}`;
    const res = await dynamodb.get({ TableName: getTableName('metadata-cache'), Key: { cacheKey } }).promise();
    return res.Item?.bookId || null;
  } catch (e) {
    console.warn('[ImageProcessor] getMappedBookId failed:', e.message);
    return null;
  }
}

async function processLibraryUpload({ bucket, key, userId, libraryType }) {
  const fileUrl = `https://${bucket}.s3.amazonaws.com/${key}`;

  // Find the draft pre-created by generateUploadUrl
  let bookId = await getMappedBookId(bucket, key);

  if (!bookId) {
    // Fallback: create minimal draft if mapping wasn't stored
    const draft = await Book.create({
      title: 'Processing…',
      description: '',
      status: 'draft',
      coverImage: fileUrl,
      category: libraryType,
      s3Bucket: bucket,
      s3Key: key,
    }, userId);
    bookId = draft.bookId;
    console.log(`[ImageProcessor] Created fallback draft: ${bookId}`);
  }

  const queueUrl = process.env.BEDROCK_ANALYZE_QUEUE_URL;
  if (queueUrl) {
    await enqueueBedrockAnalyze({ bucket, key, bookId, listingId: bookId, libraryType })
      .catch(err => console.warn('[ImageProcessor] Enqueue to BedrockAnalyzeQueue failed:', err.message));
  } else {
    await invokeBedrockAnalyzer({ bucket, key, bookId })
      .catch(err => console.warn('[ImageProcessor] Bedrock analyzer direct invoke failed:', err.message));
  }
}

async function setMappedBookId(bucket, key, bookId, userId) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const dynamodb = new DynamoDB.DocumentClient();
    const cacheKey = `bookForS3:${bucket}:${key}`;
    const timestamp = new Date().toISOString();
    const ttl = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);
    await dynamodb.put({
      TableName: getTableName('metadata-cache'),
      Item: { cacheKey, bookId, userId, s3Bucket: bucket, s3Key: key, mappedAt: timestamp, ttl },
      ConditionExpression: 'attribute_not_exists(cacheKey)'
    }).promise().catch(() => {});
  } catch (e) {
    console.warn('[ImageProcessor] setMappedBookId failed:', e.message);
  }
}

const createMinimalBookEntry = async (bucket, key, userId) => {
  const existingBookId = await getMappedBookId(bucket, key);
  if (existingBookId) {
    console.log(`[ImageProcessor] Found existing book mapping for ${key}: ${existingBookId}`);
    const existing = await Book.getById(existingBookId).catch(() => null);
    return existing || { bookId: existingBookId, userId };
  }

  const fileUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
  const bookData = {
    title: deriveBookTitleFromFilename(key),
    author: PLACEHOLDER_AUTHOR,
    description: PROCESSING_DESCRIPTION,
    coverImage: fileUrl,
    metadataSource: METADATA_SOURCE_PENDING,
    s3Bucket: bucket,
    s3Key: key,
  };
  const createdBook = await Book.create(bookData, userId);
  await setMappedBookId(bucket, key, createdBook.bookId, userId);
  console.log(`[ImageProcessor] Created book entry for uploaded image: ${createdBook.bookId} - ${key}`);
  return createdBook;
};

async function invokeBedrockAnalyzer({ bucket, key, bookId }) {
  const functionName = process.env.BEDROCK_ANALYZE_FUNCTION_NAME;
  if (!functionName) {
    console.warn('[ImageProcessor] BEDROCK_ANALYZE_FUNCTION_NAME not set; skipping direct invoke');
    return;
  }
  const lambda = new AWS.Lambda();
  const payload = { bucket, key, bookId, contentType: 'image/jpeg' };
  await lambda.invoke({
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload),
  }).promise();
  console.log('[ImageProcessor] Invoked Bedrock analyzer lambda for', key);
}

