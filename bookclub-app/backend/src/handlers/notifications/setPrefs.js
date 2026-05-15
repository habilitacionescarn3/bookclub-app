const { success, error } = require('../../lib/response');
const { setUserPrefs } = require('../../lib/notification-service');
const { withAuth } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const { userId } = event;
    if (!event.body) return error('Request body is required', 400);
    const payload = JSON.parse(event.body);
    const updates = {};

    if (typeof payload.emailOptIn === 'boolean') updates.emailOptIn = payload.emailOptIn;
    if (payload.prefs && typeof payload.prefs === 'object') updates.prefs = payload.prefs;

    const result = await setUserPrefs(userId, updates);
    return success(result);
  } catch (err) {
    console.error('Error updating notification prefs:', err);
    return error(err.message || 'Failed to update notification preferences', 500);
  }
};

module.exports.handler = withAuth(handler);
