const { success, error } = require('../../lib/response');
const BookClub = require('../../models/bookclub');
const { withClubAdmin } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const clubId = event?.pathParameters?.clubId;
    const targetUserId = event?.pathParameters?.userId;
    if (!clubId || !targetUserId) return error('clubId and userId are required', 400);

    const updated = await BookClub.approveJoinRequest(clubId, targetUserId);
    return success({ approved: true, membership: updated });
  } catch (e) {
    return error(e.message || 'Failed to approve join request', 500);
  }
};

module.exports.handler = withClubAdmin(handler);
