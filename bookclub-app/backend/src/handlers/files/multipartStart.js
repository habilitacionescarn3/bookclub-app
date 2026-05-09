const AWS = require('../../lib/aws-config');
const { v4: uuidv4 } = require('uuid');
const response = require('../../lib/response');
const ToyListing = require('../../models/toyListing');
const { getTableName } = require('../../lib/table-names');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BOOK_COVERS_BUCKET;

// Store listingId → s3Key mapping so processUpload can find the draft listing
async function storeListingMapping(bucket, key, listingId, userId) {
  try {
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const cacheKey = `listingForS3:${bucket}:${key}`;
    const ttl = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000); // 7 days
    await dynamo.put({
      TableName: getTableName('metadata-cache'),
      Item: { cacheKey, listingId, userId, s3Bucket: bucket, s3Key: key, mappedAt: new Date().toISOString(), ttl },
      ConditionExpression: 'attribute_not_exists(cacheKey)',
    }).promise().catch(() => {}); // ignore duplicate
  } catch (e) {
    console.warn('[multipartStart] storeListingMapping failed:', e.message);
  }
}

module.exports.handler = async (event) => {
  try {
    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      return response.unauthorized('Missing user context');
    }
    const { fileType, fileName, context = 'book', libraryType = 'toy' } = JSON.parse(event.body || '{}');

    if (!fileType) {
      return response.validationError({ fileType: 'File type is required' });
    }

    const validFileTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
    ];
    if (!validFileTypes.includes(fileType)) {
      console.warn(`[multipartStart] Rejected fileType=${fileType}`);
      return response.validationError({ fileType: 'Invalid file type.' });
    }

    const ext = fileType.split('/')[1] || 'jpg';
    const fileId = uuidv4();
    
    // Key format: library-images/{libraryType}/{userId}/{uuid}.ext
    const isLibrary = context === 'library';
    const key = isLibrary
      ? `library-images/${libraryType}/${userId}/${fileId}.${ext}`
      : `book-covers/${userId}/${fileId}.${ext}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      Metadata: { 'uploaded-by': userId },
    };

    const { UploadId } = await s3.createMultipartUpload(params).promise();

    // For library uploads: pre-create a draft listing
    let listingId = null;
    if (isLibrary) {
      const PINNED_CATEGORY_TYPES = ['lost_found'];
      const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
      const draft = await ToyListing.create({
        title: 'Processing…',
        description: '',
        condition: 'good',
        status: 'draft',
        images: [fileUrl],
        libraryType,
        category: PINNED_CATEGORY_TYPES.includes(libraryType) ? libraryType : null,
        userName: null,
      }, userId);
      listingId = draft.listingId;
      await storeListingMapping(BUCKET_NAME, key, listingId, userId);
    }

    return response.success({
      bucket: BUCKET_NAME,
      key,
      uploadId: UploadId,
      userId,
      listingId
    });
  } catch (err) {
    console.error('[multipartStart] error', err);
    return response.error(err);
  }
};
