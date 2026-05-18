const response = require('../../lib/response');
const { getAuthenticatedUserId } = require('../../lib/get-user-id');
const Post = require('../../models/post');

exports.handler = async (event) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return response.unauthorized('Unauthorized');

    const postId = event.pathParameters?.postId;
    if (!postId) return response.error('postId is required', 400);

    await Post.delete(postId, userId);
    return response.success({ deleted: true });
  } catch (err) {
    console.error('[Posts][delete] Error:', err);
    return response.error(err, err.statusCode || 500);
  }
};
