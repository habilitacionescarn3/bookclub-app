const response = require('../../lib/response');
const { getAuthenticatedUserId } = require('../../lib/get-user-id');
const Post = require('../../models/post');
const Comment = require('../../models/comment');
const BookClub = require('../../models/bookclub');

const parseBody = (event) => {
  try {
    return { body: JSON.parse(event.body || '{}') };
  } catch (_) {
    return { error: response.error('Invalid JSON body', 400) };
  }
};

const normalizeImages = (images) => {
  if (images === undefined) return [];
  if (!Array.isArray(images)) return null;

  const normalized = images
    .map(image => (typeof image === 'string' ? image.trim() : null))
    .filter(Boolean);

  return normalized.length === images.length ? normalized : null;
};

exports.handler = async (event) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return response.unauthorized('Unauthorized');

    const postId = event.pathParameters?.postId;
    if (!postId) return response.error('postId is required', 400);

    const { body, error } = parseBody(event);
    if (error) return error;

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const images = normalizeImages(body.images);

    const validationErrors = {};
    if (!text) validationErrors.text = 'text is required';
    if (body.images !== undefined && images === null) {
      validationErrors.images = 'images must be an array of non-empty strings';
    }
    if (Object.keys(validationErrors).length > 0) {
      return response.validationError(validationErrors);
    }

    const post = await Post.getById(postId);
    if (!post) return response.notFound('Post not found');

    const isMember = await BookClub.isMember(post.clubId, userId);
    if (!isMember) {
      return response.forbidden('You must be an active club member to comment on this post');
    }

    const comment = await Comment.create(postId, { text, images }, userId);
    return response.success(comment, 201);
  } catch (err) {
    console.error('[Comments][create] Error:', err);
    return response.error(err, err.statusCode || 500);
  }
};
