const LostFound = require('../../models/lost-found');
const BookClub = require('../../models/bookclub');
const response = require('../../lib/response');
const { publishEvent } = require('../../lib/event-bus');
const { withAuth } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const { userId } = event;
    const body = JSON.parse(event.body || '{}');
    const { clubId, title, description, itemType, foundLocation, foundDate, images } = body;

    if (!clubId) return response.error('clubId is required', 400);
    if (!title || !title.trim()) return response.error('title is required', 400);

    const isMember = await BookClub.isMember(clubId, userId);
    if (!isMember) return response.forbidden('You must be an active club member to post Lost & Found items');

    const item = await LostFound.create({ clubId, title, description, itemType, foundLocation, foundDate, images }, userId);
    
    if (item.images && item.images.length > 0) {
      try {
        await publishEvent('LostFound.ImageAnalysisRequested', {
          lostFoundId: item.lostFoundId,
          clubId: item.clubId,
          userId: userId,
          images: item.images
        });
      } catch (evtErr) {
        console.error('[LostFound] Failed to publish ImageAnalysisRequested event', evtErr);
      }
    }
    
    return response.success(item, 201);
  } catch (err) {
    console.error('[LostFound] create error:', err);
    return response.error(err.message || 'Failed to create lost & found item', 500);
  }
};

module.exports.handler = withAuth(handler);
