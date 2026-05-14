const { v4: uuidv4 } = require('uuid');
const LocalStorage = require('../lib/local-storage');
const dynamoDb = require('../lib/dynamodb');
const { getTableName } = require('../lib/table-names');

const isOffline = () =>
  process.env.IS_OFFLINE === 'true' ||
  process.env.SERVERLESS_OFFLINE === 'true' ||
  process.env.APP_ENV === 'local' ||
  process.env.NODE_ENV === 'test';

const encodeToken = (value) => (
  value ? Buffer.from(JSON.stringify(value)).toString('base64') : null
);

const decodeToken = (token) => {
  if (!token) return null;

  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch (_) {
    const err = new Error('Invalid nextToken');
    err.statusCode = 400;
    err.code = 'INVALID_NEXT_TOKEN';
    throw err;
  }
};

const createError = (message, statusCode, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

class Post {
  static async create(data, authorId) {
    const postId = uuidv4();
    const timestamp = new Date().toISOString();
    const createdAtSortKey = `${Date.now()}#${postId}`;

    const post = {
      postId,
      clubId: data.clubId,
      authorId,
      text: data.text,
      images: Array.isArray(data.images) ? data.images : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      createdAt_postId: createdAtSortKey,
    };

    if (isOffline()) {
      return LocalStorage.createPost(post);
    }

    await dynamoDb.put(getTableName('posts'), post);
    return post;
  }

  static async getById(postId) {
    if (isOffline()) {
      return LocalStorage.getPost(postId);
    }

    return dynamoDb.get(getTableName('posts'), { postId });
  }

  static async listByClub(clubId, limit = 20, nextToken = null) {
    if (isOffline()) {
      const allPosts = await LocalStorage.listPostsByClub(clubId);
      const offset = decodeToken(nextToken) || 0;
      const items = allPosts.slice(offset, offset + limit);
      const token = offset + limit < allPosts.length ? encodeToken(offset + limit) : null;
      return { items, nextToken: token };
    }

    const params = {
      TableName: getTableName('posts'),
      IndexName: 'ClubPostsIndex',
      KeyConditionExpression: 'clubId = :clubId',
      ExpressionAttributeValues: {
        ':clubId': clubId,
      },
      ScanIndexForward: false,
      Limit: limit,
    };

    const exclusiveStartKey = decodeToken(nextToken);
    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }

    const result = await dynamoDb.query(params);
    return {
      items: result.Items || [],
      nextToken: encodeToken(result.LastEvaluatedKey),
    };
  }

  static async listByClubIds(clubIds, limit = 20) {
    if (!Array.isArray(clubIds) || clubIds.length === 0) {
      return { items: [] };
    }

    const uniqueClubIds = [...new Set(clubIds)];
    const perClubLimit = Math.max(limit, 20);

    const results = await Promise.all(
      uniqueClubIds.map((clubId) => this.listByClub(clubId, perClubLimit, null))
    );

    const items = results
      .flatMap(result => result.items || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return { items };
  }

  static async delete(postId, userId) {
    const existing = await this.getById(postId);
    if (!existing) {
      throw createError('Post not found', 404, 'NOT_FOUND');
    }
    if (existing.authorId !== userId) {
      throw createError('You do not have permission to delete this post', 403, 'FORBIDDEN');
    }

    const Comment = require('./comment');
    await Comment.deleteByPostId(postId);

    if (isOffline()) {
      await LocalStorage.deletePost(postId);
      return { deleted: true };
    }

    await dynamoDb.delete({
      TableName: getTableName('posts'),
      Key: { postId },
      ConditionExpression: 'authorId = :authorId',
      ExpressionAttributeValues: {
        ':authorId': userId,
      },
    });

    return { deleted: true };
  }
}

module.exports = Post;
