const AWS = require('../../lib/aws-config');
const { v4: uuidv4 } = require('uuid');
const response = require('../../lib/response');
const Book = require('../../models/book');
const { getTableName } = require('../../lib/table-names');
const { withAuth } = require('../../lib/middleware');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BOOK_COVERS_BUCKET;

// Store bookId → s3Key mapping so processUpload can find the draft book
async function storeBookMapping(bucket, key, bookId, userId) {
  try {
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const cacheKey = `bookForS3:${bucket}:${key}`;
    const ttl = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000); // 7 days
    await dynamo.put({
      TableName: getTableName('metadata-cache'),
      Item: { cacheKey, bookId, userId, s3Bucket: bucket, s3Key: key, mappedAt: new Date().toISOString(), ttl },
      ConditionExpression: 'attribute_not_exists(cacheKey)',
    }).promise().catch(() => {}); // ignore duplicate
  } catch (e) {
    console.warn('[generateUploadUrl] storeBookMapping failed:', e.message);
  }
}

const handler = async (event) => {
  try {
    const { userId } = event;
    const { fileType, fileName, context = 'book', libraryType = 'book' } = JSON.parse(event.body || '{}');

    if (!fileType) {
      return response.validationError({ fileType: 'File type is required' });
    }

    const validFileTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
    ];
    if (!validFileTypes.includes(fileType)) {
      console.warn(`[generateUploadUrl] Rejected fileType=${fileType}`);
      return response.validationError({
        fileType: 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, HEIC/HEIF, TIFF, BMP.',
      });
    }

    const fileExtension = fileType.split('/')[1];
    const fileId = uuidv4();

    // Key format: library-images/{libraryType}/{userId}/{uuid}.ext
    const isLibrary = context === 'library';
    const fileKey = isLibrary
      ? `library-images/${libraryType}/${userId}/${fileId}.${fileExtension}`
      : `book-covers/${userId}/${fileId}.${fileExtension}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: fileType,
      Expires: 3600, // 1 hour for slow mobile uploads
    };

    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileKey}`;

    // For library uploads: pre-create a draft book so frontend can poll it immediately
    let bookId = null;
    if (isLibrary) {
      const draft = await Book.create({
        title: 'Processing…',
        description: '',
        status: 'draft',
        coverImage: fileUrl,
        category: libraryType,
        s3Bucket: BUCKET_NAME,
        s3Key: fileKey,
      }, userId);
      bookId = draft.bookId;
      await storeBookMapping(BUCKET_NAME, fileKey, bookId, userId);
    }

    return response.success({ uploadUrl, fileUrl, fileKey, bookId, listingId: bookId, userId });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return response.error(error);
  }
};

module.exports.handler = withAuth(handler);
