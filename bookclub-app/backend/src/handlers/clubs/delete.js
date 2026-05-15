const BookClub = require('../../models/bookclub');
const { success, error } = require('../../lib/response');
const { withClubOwner } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const { clubId } = event.pathParameters || {};
    if (!clubId) return error('clubId is required in path', 400);

    await BookClub.delete(clubId);
    return success({ deleted: true });
  } catch (err) {
    console.error('Error deleting club:', err);
    return error(err.message || 'Failed to delete club', 500);
  }
};

module.exports.handler = withClubOwner(handler);
