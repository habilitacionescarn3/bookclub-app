// Use local storage path for model tests
process.env.IS_OFFLINE = 'true';
process.env.NODE_ENV = 'development';

const path = require('path');
const fs = require('fs');

const Event = require('../../../src/models/event');

const STORAGE_DIR = path.join(__dirname, '../../../.local-storage');
const EVENTS_FILE = path.join(STORAGE_DIR, 'events.json');

function clearEventsFile() {
  try {
    if (fs.existsSync(EVENTS_FILE)) fs.unlinkSync(EVENTS_FILE);
  } catch (_) {
    // ignore
  }
}

describe('Event model', () => {
  beforeEach(() => {
    clearEventsFile();
  });

  afterAll(() => {
    clearEventsFile();
  });

  describe('generateRecurringDates', () => {
    test('returns only the start date for pattern "none"', () => {
      const dates = Event.generateRecurringDates(
        '2026-06-01T18:00:00.000Z',
        'none',
        '2026-08-01'
      );
      expect(dates).toHaveLength(1);
      expect(dates[0]).toBe(new Date('2026-06-01T18:00:00.000Z').toISOString());
    });

    test('generates weekly occurrences up to the end date', () => {
      const start = '2026-06-01T18:00:00.000Z';
      const dates = Event.generateRecurringDates(start, 'weekly', '2026-06-29');
      // 06-01, 06-08, 06-15, 06-22, 06-29 = 5 dates
      expect(dates).toHaveLength(5);
      expect(new Date(dates[1]).getUTCDate()).toBe(8);
      expect(new Date(dates[4]).getUTCDate()).toBe(29);
    });

    test('generates biweekly occurrences', () => {
      const dates = Event.generateRecurringDates(
        '2026-06-01T18:00:00.000Z',
        'biweekly',
        '2026-07-13'
      );
      // 06-01, 06-15, 06-29, 07-13 = 4
      expect(dates).toHaveLength(4);
    });

    test('generates monthly occurrences', () => {
      const dates = Event.generateRecurringDates(
        '2026-06-01T18:00:00.000Z',
        'monthly',
        '2026-09-01'
      );
      // 06-01, 07-01, 08-01, 09-01 = 4
      expect(dates).toHaveLength(4);
    });

    test('generates daily occurrences', () => {
      const dates = Event.generateRecurringDates(
        '2026-06-01T18:00:00.000Z',
        'daily',
        '2026-06-05'
      );
      expect(dates).toHaveLength(5);
    });

    test('caps occurrences at 26 weeks from start even if endDate is later', () => {
      const start = '2026-06-01T18:00:00.000Z';
      const farFuture = '2027-06-01'; // ~52 weeks out
      const dates = Event.generateRecurringDates(start, 'weekly', farFuture);
      // 26 weeks => roughly 26-27 occurrences
      expect(dates.length).toBeGreaterThanOrEqual(26);
      expect(dates.length).toBeLessThanOrEqual(27);
      const last = new Date(dates[dates.length - 1]);
      const startMs = new Date(start).getTime();
      const diffWeeks = (last.getTime() - startMs) / (7 * 24 * 60 * 60 * 1000);
      expect(diffWeeks).toBeLessThanOrEqual(26);
    });

    test('weekly recurrence is DST-safe (US spring-forward window)', () => {
      // Start 2026-03-01 12:00 UTC, weekly through 2026-04-05.
      // US "spring forward" DST transition is 2026-03-08. UTC instants must
      // remain exactly 7 days apart regardless of local DST.
      const dates = Event.generateRecurringDates(
        '2026-03-01T12:00:00.000Z',
        'weekly',
        '2026-04-05'
      );
      // 03-01, 03-08, 03-15, 03-22, 03-29, 04-05 = 6
      expect(dates).toHaveLength(6);
      for (let i = 1; i < dates.length; i++) {
        const deltaMs = new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime();
        expect(deltaMs).toBe(7 * 24 * 60 * 60 * 1000);
      }
      // Each occurrence preserves the original UTC hour-of-day
      dates.forEach((iso) => {
        const d = new Date(iso);
        expect(d.getUTCHours()).toBe(12);
        expect(d.getUTCMinutes()).toBe(0);
      });
    });

    test('monthly recurrence preserves the UTC day-of-month', () => {
      const dates = Event.generateRecurringDates(
        '2026-01-15T09:00:00.000Z',
        'monthly',
        '2026-05-15'
      );
      // 01-15, 02-15, 03-15, 04-15, 05-15 = 5
      expect(dates).toHaveLength(5);
      dates.forEach((iso) => {
        const d = new Date(iso);
        expect(d.getUTCDate()).toBe(15);
        expect(d.getUTCHours()).toBe(9);
      });
    });

    test('returns empty array when end date is before start', () => {
      const dates = Event.generateRecurringDates(
        '2026-06-01T18:00:00.000Z',
        'weekly',
        '2026-05-01'
      );
      expect(dates).toHaveLength(0);
    });
  });

  describe('createSeries', () => {
    const userId = 'u1';
    const userName = 'Alice';

    test('creates a single event when pattern is "none"', async () => {
      const events = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'One-off',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'none',
        },
        userId,
        userName
      );
      expect(events).toHaveLength(1);
      expect(events[0].parentEventId).toBeNull();
      expect(events[0].recurrencePattern).toBe('none');
    });

    test('creates a single event when no recurrenceEndDate is provided', async () => {
      const events = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'Weekly?',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'weekly',
        },
        userId,
        userName
      );
      expect(events).toHaveLength(1);
    });

    test('creates parent + children with proper linkage for weekly series', async () => {
      const events = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'Weekly Meeting',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'weekly',
          recurrenceEndDate: '2026-06-22',
        },
        userId,
        userName
      );

      // 06-01, 06-08, 06-15, 06-22 = 4
      expect(events).toHaveLength(4);

      const [parent, ...children] = events;
      expect(parent.parentEventId).toBeNull();
      expect(parent.recurrencePattern).toBe('weekly');
      expect(parent.recurrenceEndDate).toBe('2026-06-22');

      for (const child of children) {
        expect(child.parentEventId).toBe(parent.eventId);
        expect(child.recurrencePattern).toBe('none');
        expect(child.recurrenceEndDate).toBeNull();
        expect(child.isRecurringInstance).toBe(true);
      }
    });
  });

  describe('getSeries', () => {
    test('returns parent + all children sorted by dateTime', async () => {
      const [parent] = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'S1',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'weekly',
          recurrenceEndDate: '2026-06-15',
        },
        'u1',
        'Alice'
      );

      const series = await Event.getSeries(parent.eventId);
      expect(series).toHaveLength(3);
      // First item is the parent (earliest date)
      expect(series[0].eventId).toBe(parent.eventId);
      // Sorted ascending by dateTime
      for (let i = 1; i < series.length; i++) {
        expect(new Date(series[i].dateTime).getTime()).toBeGreaterThan(
          new Date(series[i - 1].dateTime).getTime()
        );
      }
    });

    test('returns empty array when parent does not exist', async () => {
      const series = await Event.getSeries('nonexistent-id');
      expect(series).toEqual([]);
    });
  });

  describe('updateSeriesFrom', () => {
    test('updates only this and future events, leaving past events alone', async () => {
      const events = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'Orig',
          description: 'Orig desc',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'weekly',
          recurrenceEndDate: '2026-06-22',
        },
        'u1',
        'Alice'
      );
      expect(events).toHaveLength(4);

      // Update from the 3rd occurrence (2026-06-15) onward
      const fromId = events[2].eventId;
      const updated = await Event.updateSeriesFrom(fromId, { title: 'Changed' });
      expect(updated).toHaveLength(2); // 06-15 and 06-22

      // Verify in storage
      const allInSeries = await Event.getSeries(events[0].eventId);
      expect(allInSeries[0].title).toBe('Orig');
      expect(allInSeries[1].title).toBe('Orig');
      expect(allInSeries[2].title).toBe('Changed');
      expect(allInSeries[3].title).toBe('Changed');
    });

    test('does not allow dateTime or recurrence fields to be changed', async () => {
      const events = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'T',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'weekly',
          recurrenceEndDate: '2026-06-15',
        },
        'u1',
        'Alice'
      );
      const originalDates = events.map(e => e.dateTime);

      await Event.updateSeriesFrom(events[0].eventId, {
        title: 'New',
        dateTime: '2099-01-01T00:00:00.000Z',
        recurrencePattern: 'daily',
        recurrenceEndDate: '2099-12-31',
      });

      const series = await Event.getSeries(events[0].eventId);
      series.forEach((evt, idx) => {
        expect(evt.dateTime).toBe(originalDates[idx]);
      });
      // recurrencePattern on parent should remain weekly
      expect(series[0].recurrencePattern).toBe('weekly');
    });
  });

  describe('deleteSeries', () => {
    test('deletes parent and all children', async () => {
      const events = await Event.createSeries(
        {
          clubId: 'c1',
          title: 'D',
          dateTime: '2026-06-01T18:00:00.000Z',
          recurrencePattern: 'weekly',
          recurrenceEndDate: '2026-06-15',
        },
        'u1',
        'Alice'
      );
      expect(events).toHaveLength(3);

      const ok = await Event.deleteSeries(events[0].eventId);
      expect(ok).toBe(true);

      for (const evt of events) {
        const found = await Event.getById(evt.eventId);
        expect(found).toBeNull();
      }
    });
  });
});
