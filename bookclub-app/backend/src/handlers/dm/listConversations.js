const { success, error } = require('../../lib/response');
const DM = require('../../models/dm');
const { withAuth } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const { userId } = event;
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit, 10) : 20;
    const list = await DM.listConversationsForUser(userId, Math.min(Math.max(limit, 1), 100));
    return success(list);
  } catch (e) {
    console.error('Error listing conversations:', e);
    return error(e.message || 'Failed to list conversations', 500);
  }
};

module.exports.handler = withAuth(handler);
