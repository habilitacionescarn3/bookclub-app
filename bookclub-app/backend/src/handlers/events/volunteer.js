const { z } = require('zod');
const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');

const VolunteerSchema = z.object({
  task: z.string().min(1).nullable(),
});

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;
  const userName = event.currentUser.name;

  if (!clubId || !eventId) {
    return response.validationError({ message: 'Club ID and Event ID are required' });
  }

  // Verify membership or creator status
  const isMember = await BookClub.isClubMember(clubId, userId);
  const club = await BookClub.getById(clubId);
  if (!club) {
    return response.notFound('Club not found');
  }

  const isCreator = club.createdBy === userId;
  if (!isMember && !isCreator) {
    return response.forbidden('You must be a member of the club to volunteer');
  }

  const dbEvent = await Event.getById(eventId);
  if (!dbEvent || dbEvent.clubId !== clubId) {
    return response.notFound('Event not found');
  }

  const body = JSON.parse(event.body || '{}');
  const { task } = VolunteerSchema.parse(body);

  // If a task is specified, verify it exists in the event's defined task slots
  if (task && !dbEvent.volunteerTasks.includes(task)) {
    return response.validationError({ message: `The volunteer task "${task}" is not defined for this event` });
  }

  // Verify that the task slot is not already taken by someone else
  if (task) {
    const isTaken = Object.entries(dbEvent.volunteers || {}).some(
      ([uid, info]) => info.task === task && uid !== userId
    );
    if (isTaken) {
      return response.validationError({ message: 'This volunteer task is already filled' });
    }
  }

  const updatedEvent = await Event.volunteer(eventId, userId, userName, task);
  return response.success(updatedEvent);
};

module.exports.handler = withUser(handler);
