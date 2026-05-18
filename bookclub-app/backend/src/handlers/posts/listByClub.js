const response = require('../../lib/response');
const { getAuthenticatedUserId } = require('../../lib/get-user-id');
const BookClub = require('../../models/bookclub');
const Post = require('../../models/post');
const { enrichPosts } = require('./shared');

const parseLimit = (rawLimit) => {
  const parsed = parseInt(rawLimit || '20', 10);
  if (Number.isNaN(parsed) || parsed < 1) return 20;
  return Math.min(parsed, 50);
};

exports.handler = async (event) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return response.unauthorized('Unauthorized');

    const clubId = event.pathParameters?.clubId;
    if (!clubId) return response.error('clubId is required', 400);

    const club = await BookClub.getById(clubId);
    if (!club) return response.notFound('Club not found');

    const isMember = await BookClub.isMember(clubId, userId);
    if (!isMember) {
      return response.forbidden('You must be an active club member to read posts');
    }

    const limit = parseLimit(event.queryStringParameters?.limit);
    const nextToken = event.queryStringParameters?.nextToken || null;
    const result = await Post.listByClub(clubId, limit, nextToken);
    const items = await enrichPosts(result.items, userId);

    return response.success({
      items,
      count: items.length,
      nextToken: result.nextToken || null,
    });
  } catch (err) {
    console.error('[Posts][listByClub] Error:', err);
    return response.error(err, err.statusCode || 500);
  }
};
