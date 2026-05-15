const BookClub = require('../../models/bookclub');
const { success, error } = require('../../lib/response');
const { withClubAdmin } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const clubId = event.pathParameters.clubId;
    const payload = parseBody(event);
    if (!payload) return error('Request body is required', 400);

    const updates = pickAllowedUpdates(payload, ['name', 'description', 'location', 'isPrivate', 'memberLimit', 'slug']);
    const validationError = validateUpdates(updates);
    if (validationError) return validationError;

    const updated = await BookClub.update(clubId, updates);
    return success(updated);
  } catch (err) {
    console.error('Error updating club:', err);
    return error(err.message || 'Failed to update club', err.statusCode || 500);
  }
};

const parseBody = (event) => {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
};

const pickAllowedUpdates = (payload, allowed) => {
  const updates = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      updates[key] = payload[key];
    }
  }
  return updates;
};

const validateUpdates = (updates) => {
  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || updates.name.trim().length === 0) {
      return error('Club name must be a non-empty string', 400);
    }
    if (updates.name.length > 100) {
      return error('Club name must be 100 characters or less', 400);
    }
    updates.name = updates.name.trim();
  }

  if (updates.description !== undefined) {
    if (typeof updates.description !== 'string') {
      return error('Description must be a string', 400);
    }
    if (updates.description.length > 500) {
      return error('Club description must be 500 characters or less', 400);
    }
    updates.description = updates.description.trim();
  }

  if (updates.location !== undefined) {
    if (typeof updates.location !== 'string' || updates.location.trim().length === 0) {
      return error('Location must be a non-empty string', 400);
    }
    if (updates.location.length > 100) {
      return error('Location must be 100 characters or less', 400);
    }
    updates.location = updates.location.trim();
  }

  if (updates.isPrivate !== undefined) {
    updates.isPrivate = !!updates.isPrivate;
  }

  if (updates.memberLimit !== undefined) {
    if (updates.memberLimit !== null && (typeof updates.memberLimit !== 'number' || updates.memberLimit < 2 || updates.memberLimit > 1000)) {
      return error('Member limit must be a number between 2 and 1000 (or null)', 400);
    }
  }

  if (updates.slug !== undefined) {
    const s = (updates.slug || '').trim();
    if (!s) return error('Slug cannot be empty', 400);
    if (s.length > 60) return error('Slug must be 60 characters or less', 400);
    const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!SLUG_RE.test(s)) return error('Slug may only contain lowercase letters, numbers, and hyphens', 400);
    updates.slug = s;
  }

  return null;
};

module.exports.handler = withClubAdmin(handler);
