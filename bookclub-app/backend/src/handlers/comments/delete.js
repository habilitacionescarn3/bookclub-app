const response = require('../../lib/response');
const { getAuthenticatedUserId } = require('../../lib/get-user-id');
const Comment = require('../../models/comment');

exports.handler = async (event) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return response.unauthorized('Unauthorized');

    const postId = event.pathParameters?.postId;
    const commentId = event.pathParameters?.commentId;
    if (!postId || !commentId) {
      return response.error('postId and commentId are required', 400);
    }

    await Comment.delete(postId, commentId, userId);
    return response.success({ deleted: true });
  } catch (err) {
    console.error('[Comments][delete] Error:', err);
    return response.error(err, err.statusCode || 500);
  }
};
