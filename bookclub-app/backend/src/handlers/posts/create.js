const response = require('../../lib/response');
const { getAuthenticatedUserId } = require('../../lib/get-user-id');
const BookClub = require('../../models/bookclub');
const Post = require('../../models/post');

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

    const { body, error } = parseBody(event);
    if (error) return error;

    const clubId = typeof body.clubId === 'string' ? body.clubId.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const images = normalizeImages(body.images);

    const validationErrors = {};
    if (!clubId) validationErrors.clubId = 'clubId is required';
    if (!text) validationErrors.text = 'text is required';
    if (body.images !== undefined && images === null) {
      validationErrors.images = 'images must be an array of non-empty strings';
    }
    if (Object.keys(validationErrors).length > 0) {
      return response.validationError(validationErrors);
    }

    const club = await BookClub.getById(clubId);
    if (!club) return response.notFound('Club not found');

    const isMember = await BookClub.isMember(clubId, userId);
    if (!isMember) {
      return response.forbidden('You must be an active club member to create posts');
    }

    const post = await Post.create({ clubId, text, images }, userId);
    return response.success({ ...post, comments: [], commentCount: 0 }, 201);
  } catch (err) {
    console.error('[Posts][create] Error:', err);
    return response.error(err, err.statusCode || 500);
  }
};
