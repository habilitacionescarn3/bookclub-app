const { success, error } = require('../../lib/response');
const { getUserPrefs } = require('../../lib/notification-service');
const { withAuth } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const { userId } = event;
    const prefs = await getUserPrefs(userId);
    return success(prefs);
  } catch (err) {
    console.error('Error getting notification prefs:', err);
    return error(err.message || 'Failed to get notification preferences', 500);
  }
};

module.exports.handler = withAuth(handler);
