const { v4: uuidv4 } = require('uuid');
const LocalStorage = require('../lib/local-storage');
const dynamoDb = require('../lib/dynamodb');
const { getTableName } = require('../lib/table-names');

const isOffline = () =>
  process.env.IS_OFFLINE === 'true' ||
  process.env.SERVERLESS_OFFLINE === 'true' ||
  process.env.APP_ENV === 'local' ||
  process.env.NODE_ENV === 'test';

const createError = (message, statusCode, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

class Comment {
  static async create(postId, data, userId) {
    const commentId = uuidv4();
    const timestamp = new Date().toISOString();
    const createdAtSortKey = `${Date.now()}#${commentId}`;

    const comment = {
      commentId,
      postId,
      userId,
      text: data.text,
      images: Array.isArray(data.images) ? data.images : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      createdAt_commentId: createdAtSortKey,
    };

    if (isOffline()) {
      return LocalStorage.createComment(comment);
    }

    await dynamoDb.put(getTableName('comments'), comment);
    return comment;
  }

  static async listByPost(postId) {
    if (isOffline()) {
      return LocalStorage.listCommentsByPost(postId);
    }

    const items = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: getTableName('comments'),
        KeyConditionExpression: 'postId = :postId',
        ExpressionAttributeValues: {
          ':postId': postId,
        },
        ScanIndexForward: true,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoDb.query(params);
      items.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey || null;
    } while (lastEvaluatedKey);

    return items;
  }

  static async listByPostIds(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return {};
    }

    const uniquePostIds = [...new Set(postIds)];
    const results = await Promise.all(
      uniquePostIds.map(async (postId) => [postId, await this.listByPost(postId)])
    );

    return Object.fromEntries(results);
  }

  static async findByPostAndCommentId(postId, commentId) {
    if (isOffline()) {
      return LocalStorage.getComment(postId, commentId);
    }

    const comments = await this.listByPost(postId);
    return comments.find(comment => comment.commentId === commentId) || null;
  }

  static async delete(postId, commentId, userId) {
    const existing = await this.findByPostAndCommentId(postId, commentId);
    if (!existing) {
      throw createError('Comment not found', 404, 'NOT_FOUND');
    }
    if (existing.userId !== userId) {
      throw createError('You do not have permission to delete this comment', 403, 'FORBIDDEN');
    }

    if (isOffline()) {
      await LocalStorage.deleteComment(postId, commentId);
      return { deleted: true };
    }

    await dynamoDb.delete({
      TableName: getTableName('comments'),
      Key: {
        postId,
        createdAt_commentId: existing.createdAt_commentId,
      },
      ConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    return { deleted: true };
  }

  static async deleteByPostId(postId) {
    const comments = await this.listByPost(postId);
    if (comments.length === 0) {
      return { deleted: 0 };
    }

    if (isOffline()) {
      const deleted = await LocalStorage.deleteCommentsByPost(postId);
      return { deleted };
    }

    await Promise.all(
      comments.map(comment => dynamoDb.delete({
        TableName: getTableName('comments'),
        Key: {
          postId,
          createdAt_commentId: comment.createdAt_commentId,
        },
      }))
    );

    return { deleted: comments.length };
  }
}

module.exports = Comment;
