const { v4: uuidv4 } = require('uuid');
const LocalStorage = require('../lib/local-storage');
const dynamoDb = require('../lib/dynamodb');
const { getTableName } = require('../lib/table-names');

const isOffline = () =>
  process.env.IS_OFFLINE === 'true' ||
  process.env.SERVERLESS_OFFLINE === 'true' ||
  process.env.APP_ENV === 'local' ||
  process.env.NODE_ENV === 'test';

// Recurrence pattern helpers
const RECURRENCE_PATTERNS = ['none', 'daily', 'weekly', 'biweekly', 'monthly'];

class Event {
  static async create(data, userId, userName) {
    const now = new Date().toISOString();
    const event = {
      eventId: uuidv4(),
      clubId: data.clubId,
      title: data.title,
      description: data.description || '',
      dateTime: data.dateTime,
      location: data.location || '',
      createdBy: userId,
      creatorName: userName || 'Anonymous',
      organizers: {
        [userId]: {
          name: userName || 'Anonymous',
          nominatedAt: now
        }
      },
      volunteerTasks: Array.isArray(data.volunteerTasks) ? data.volunteerTasks : [],
      volunteers: {},
      rsvps: {},
      discussions: [],
      // Recurrence fields
      parentEventId: data.parentEventId || null,
      recurrencePattern: data.recurrencePattern || 'none',
      recurrenceEndDate: data.recurrenceEndDate || null,
      isRecurringInstance: data.parentEventId ? true : false,
      createdAt: now,
      updatedAt: now,
    };

    if (isOffline()) {
      return LocalStorage.createEvent(event);
    }

    await dynamoDb.put(getTableName('bookclub-events'), event);
    return event;
  }

  // Generate recurring event dates based on pattern
  static generateRecurringDates(startDate, pattern, maxDate) {
    const dates = [];
    const start = new Date(startDate);
    // Interpret maxDate as inclusive of the entire day. If the input is a
    // YYYY-MM-DD string (no time component), shift to end-of-day UTC so events
    // occurring later in the day on the end date are still included.
    const max = new Date(maxDate);
    if (typeof maxDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) {
      max.setUTCHours(23, 59, 59, 999);
    }

    // Limit to 26 weeks from start
    const twentySixWeeksFromStart = new Date(start.getTime() + 26 * 7 * 24 * 60 * 60 * 1000);
    const effectiveMax = max < twentySixWeeksFromStart ? max : twentySixWeeksFromStart;
    
    let current = new Date(start);
    
    while (current <= effectiveMax) {
      dates.push(new Date(current).toISOString());
      
      // Use UTC methods so recurrence is deterministic regardless of the
      // process timezone and DST transitions. Events recur at the same
      // absolute UTC instant; wall-clock display is the renderer's concern.
      switch (pattern) {
        case 'daily':
          current.setUTCDate(current.getUTCDate() + 1);
          break;
        case 'weekly':
          current.setUTCDate(current.getUTCDate() + 7);
          break;
        case 'biweekly':
          current.setUTCDate(current.getUTCDate() + 14);
          break;
        case 'monthly':
          current.setUTCMonth(current.getUTCMonth() + 1);
          break;
        default:
          return dates; // Only return first date for non-recurring
      }
    }
    
    return dates;
  }

  // Create a series of recurring events
  static async createSeries(baseData, userId, userName) {
    const { recurrencePattern, recurrenceEndDate, dateTime, ...base } = baseData;
    
    if (!recurrencePattern || recurrencePattern === 'none' || !recurrenceEndDate) {
      // Single event
      return [await this.create({ ...base, dateTime }, userId, userName)];
    }
    
    // Generate all dates in the series
    const dates = this.generateRecurringDates(dateTime, recurrencePattern, recurrenceEndDate);
    
    if (dates.length === 0) {
      throw new Error('No valid dates generated for recurring series');
    }
    
    // Create the parent event (first one)
    const parentEvent = await this.create({
      ...base,
      dateTime: dates[0],
      recurrencePattern,
      recurrenceEndDate,
    }, userId, userName);
    
    const events = [parentEvent];
    const parentId = parentEvent.eventId;
    
    // Create child events
    for (let i = 1; i < dates.length; i++) {
      const child = await this.create({
        ...base,
        dateTime: dates[i],
        parentEventId: parentId,
        recurrencePattern: 'none', // Children don't have their own pattern
        recurrenceEndDate: null,
      }, userId, userName);
      events.push(child);
    }
    
    return events;
  }

  // Get all events in a series (parent + children)
  static async getSeries(parentEventId) {
    if (isOffline()) {
      const parent = await LocalStorage.getEvent(parentEventId);
      if (!parent) return [];
      const allEvents = await LocalStorage.listEventsByClub(parent.clubId);
      return (allEvents || []).filter(e =>
        e.eventId === parentEventId || e.parentEventId === parentEventId
      ).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    }

    // Look up the parent event via EventIdIndex GSI to discover its clubId.
    const parent = await this.getById(parentEventId);
    if (!parent) return [];

    // Query within the club partition (efficient) and filter for series members.
    const result = await dynamoDb.query({
      TableName: getTableName('bookclub-events'),
      KeyConditionExpression: 'clubId = :clubId',
      FilterExpression: 'eventId = :parentId OR parentEventId = :parentId',
      ExpressionAttributeValues: {
        ':clubId': parent.clubId,
        ':parentId': parentEventId,
      },
    });

    return (result.Items || []).sort((a, b) =>
      new Date(a.dateTime) - new Date(b.dateTime)
    );
  }

  // Delete all events in a series
  static async deleteSeries(parentEventId) {
    const events = await this.getSeries(parentEventId);
    const results = [];
    
    for (const evt of events) {
      results.push(await this.delete(evt.eventId));
    }
    
    return results.every(r => r === true);
  }

  // Update all future events in a series from a given event
  static async updateSeriesFrom(eventId, updates) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');
    
    const parentId = event.parentEventId || event.eventId;
    const allEvents = await this.getSeries(parentId);
    
    // Only update this event and all future ones
    const targetDate = new Date(event.dateTime);
    const futureEvents = allEvents.filter(e => new Date(e.dateTime) >= targetDate);
    
    const results = [];
    for (const evt of futureEvents) {
      // Don't change the dateTime or recurrence fields
      const allowedUpdates = {};
      if (updates.title !== undefined) allowedUpdates.title = updates.title;
      if (updates.description !== undefined) allowedUpdates.description = updates.description;
      if (updates.location !== undefined) allowedUpdates.location = updates.location;
      if (updates.volunteerTasks !== undefined) allowedUpdates.volunteerTasks = updates.volunteerTasks;
      
      if (Object.keys(allowedUpdates).length > 0) {
        results.push(await this.update(evt.eventId, allowedUpdates));
      }
    }
    
    return results;
  }

  static async getById(eventId) {
    if (isOffline()) {
      return LocalStorage.getEvent(eventId);
    }
    // Table primary key is composite (clubId HASH + eventId RANGE),
    // so we use the EventIdIndex GSI to look up by eventId alone.
    const result = await dynamoDb.query({
      TableName: getTableName('bookclub-events'),
      IndexName: 'EventIdIndex',
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId },
      Limit: 1,
    });
    return (result.Items && result.Items[0]) || null;
  }

  /**
   * List events for a club.
   *
   * Backward-compatible default (no options): returns a chronologically
   * sorted Array<ClubEvent>, transparently following DynamoDB pagination
   * tokens so that clubs with > 1 MB of events are not truncated.
   *
   * When `opts.limit` is provided, returns `{ items, nextToken }` so
   * callers can paginate explicitly. Sort order in this mode follows the
   * table's natural key order (eventId asc within the partition).
   */
  static async listByClub(clubId, opts = {}) {
    const { limit, nextToken } = opts;
    const paginated = limit != null;

    if (isOffline()) {
      const all = await LocalStorage.listEventsByClub(clubId);
      if (!paginated) return all;
      // Naive offset-style pagination using nextToken as a numeric cursor.
      const start = nextToken ? parseInt(nextToken, 10) || 0 : 0;
      const end = start + limit;
      const slice = all.slice(start, end);
      return {
        items: slice,
        nextToken: end < all.length ? String(end) : null,
      };
    }

    const baseParams = {
      TableName: getTableName('bookclub-events'),
      KeyConditionExpression: 'clubId = :clubId',
      ExpressionAttributeValues: { ':clubId': clubId },
    };

    if (paginated) {
      const params = { ...baseParams, Limit: limit };
      if (nextToken) {
        try {
          params.ExclusiveStartKey = JSON.parse(
            Buffer.from(nextToken, 'base64').toString('utf8')
          );
        } catch (_e) {
          // Ignore invalid tokens; treat as start-of-list
        }
      }
      const result = await dynamoDb.query(params);
      const next = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null;
      return { items: result.Items || [], nextToken: next };
    }

    // Default: follow all pages and return a chronologically sorted array.
    const items = [];
    let lastKey;
    do {
      const params = { ...baseParams };
      if (lastKey) params.ExclusiveStartKey = lastKey;
      // eslint-disable-next-line no-await-in-loop
      const result = await dynamoDb.query(params);
      if (result.Items && result.Items.length) items.push(...result.Items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  }

  static async update(eventId, updates) {
    const existing = await this.getById(eventId);
    if (!existing) return null;

    const allowed = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.dateTime !== undefined) allowed.dateTime = updates.dateTime;
    if (updates.location !== undefined) allowed.location = updates.location;
    if (Array.isArray(updates.volunteerTasks)) allowed.volunteerTasks = updates.volunteerTasks;
    if (updates.volunteers !== undefined) allowed.volunteers = updates.volunteers;
    if (updates.rsvps !== undefined) allowed.rsvps = updates.rsvps;
    if (updates.discussions !== undefined) allowed.discussions = updates.discussions;
    if (updates.organizers !== undefined) allowed.organizers = updates.organizers;

    const now = new Date().toISOString();
    const merged = { ...existing, ...allowed, updatedAt: now };

    if (isOffline()) {
      return LocalStorage.updateEvent(eventId, merged);
    }

    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      dynamoDb.generateUpdateExpression({ ...allowed, updatedAt: now });

    // Since our primary key is clubId + eventId in DDB, we need clubId.
    const result = await dynamoDb.update({
      TableName: getTableName('bookclub-events'),
      Key: { clubId: existing.clubId, eventId },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });
    return result.Attributes;
  }

  static async delete(eventId) {
    const existing = await this.getById(eventId);
    if (!existing) return false;

    if (isOffline()) {
      return LocalStorage.deleteEvent(eventId);
    }

    await dynamoDb.delete(getTableName('bookclub-events'), { clubId: existing.clubId, eventId });
    return true;
  }

  // RSVP helper
  static async rsvp(eventId, userId, userName, status) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const rsvps = { ...event.rsvps };
    rsvps[userId] = {
      name: userName || 'Anonymous',
      status,
      updatedAt: new Date().toISOString(),
    };

    return this.update(eventId, { rsvps });
  }

  // Volunteer helper
  static async volunteer(eventId, userId, userName, task) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const volunteers = { ...event.volunteers };
    if (task) {
      // Check if user is already volunteering for another task, clear it if so (limit to 1 task per user per event)
      for (const [uid, info] of Object.entries(volunteers)) {
        if (uid === userId) {
          delete volunteers[uid];
        }
      }
      volunteers[userId] = {
        name: userName || 'Anonymous',
        task,
        signedUpAt: new Date().toISOString(),
      };
    } else {
      // Clear volunteer slot for this user
      delete volunteers[userId];
    }

    return this.update(eventId, { volunteers });
  }

  // Discussion comment helper
  static async addComment(eventId, userId, userName, content) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const discussions = [...(event.discussions || [])];
    discussions.push({
      commentId: uuidv4(),
      userId,
      name: userName || 'Anonymous',
      content,
      createdAt: new Date().toISOString(),
    });

    return this.update(eventId, { discussions });
  }
}

module.exports = Event;
