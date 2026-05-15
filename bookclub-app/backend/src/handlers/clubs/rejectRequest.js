const { success, error } = require('../../lib/response');
const BookClub = require('../../models/bookclub');
const { withClubAdmin } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const clubId = event?.pathParameters?.clubId;
    const targetUserId = event?.pathParameters?.userId;
    if (!clubId || !targetUserId) return error('clubId and userId are required', 400);

    await BookClub.rejectJoinRequest(clubId, targetUserId);
    return success({ rejected: true });
  } catch (e) {
    return error(e.message || 'Failed to reject join request', 500);
  }
};

module.exports.handler = withClubAdmin(handler);
