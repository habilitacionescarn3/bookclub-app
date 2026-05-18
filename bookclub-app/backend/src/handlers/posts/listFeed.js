const response = require('../../lib/response');
const { getAuthenticatedUserId } = require('../../lib/get-user-id');
const BookClub = require('../../models/bookclub');
const Post = require('../../models/post');
const { enrichPosts } = require('./shared');

exports.handler = async (event) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return response.unauthorized('Unauthorized');

    const clubs = await BookClub.getUserClubs(userId);
    const activeClubIds = (clubs || [])
      .filter(club => club.userStatus === 'active')
      .map(club => club.clubId);

    if (activeClubIds.length === 0) {
      return response.success({ items: [], count: 0 });
    }

    const result = await Post.listByClubIds(activeClubIds, 20);
    const items = await enrichPosts(result.items, userId);

    return response.success({
      items,
      count: items.length,
    });
  } catch (err) {
    console.error('[Posts][listFeed] Error:', err);
    return response.error(err, err.statusCode || 500);
  }
};
