const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const User = require('../../models/user');
const { withUser } = require('../../lib/middleware');
const { sendEmailIfEnabled } = require('../../lib/notification-service');

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;

  if (!clubId || !eventId) {
    return response.validationError({ message: 'Club ID and Event ID are required' });
  }

  // Verify club exists
  const club = await BookClub.getById(clubId);
  if (!club) {
    return response.notFound('Club not found');
  }

  // Verify event exists and matches the clubId
  const dbEvent = await Event.getById(eventId);
  if (!dbEvent || dbEvent.clubId !== clubId) {
    return response.notFound('Event not found');
  }

  // Verify caller is the event creator, club creator, or club admin
  const memberRecord = await BookClub.getMemberRecord(clubId, userId);
  const isEventCreator = dbEvent.createdBy === userId;
  const isClubCreator = club.createdBy === userId;
  const isAdmin = memberRecord && memberRecord.role === 'admin' && memberRecord.status === 'active';

  if (!isEventCreator && !isClubCreator && !isAdmin) {
    return response.forbidden('Only the event creator or club administrators can send reminders');
  }

  // Find all RSVPs with 'going' or 'interested' status
  const rsvps = dbEvent.rsvps || {};
  const recipientUserIds = Object.keys(rsvps).filter(
    (uid) => rsvps[uid].status === 'going' || rsvps[uid].status === 'interested'
  );

  if (recipientUserIds.length === 0) {
    return response.success({ message: 'No participants to remind', sentCount: 0 });
  }

  const baseUrl = process.env.SITE_BASE_URL || 'http://localhost:3000';
  const eventUrl = `${baseUrl.replace(/\/$/, '')}/clubs/${club.slug}/events`;

  const templateData = {
    eventTitle: dbEvent.title,
    clubName: club.name,
    dateTime: dbEvent.dateTime,
    description: dbEvent.description,
    eventUrl,
  };

  const sendPromises = recipientUserIds.map((uid) =>
    sendEmailIfEnabled(uid, 'reminder_due_date', 'event_reminder', templateData)
  );

  const results = await Promise.all(sendPromises);
  const sentCount = results.filter(r => r.sent).length;

  return response.success({
    message: `Reminders sent to ${sentCount} participant(s)`,
    sentCount,
    recipients: recipientUserIds,
  });
};

module.exports.handler = withUser(handler);
