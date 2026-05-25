const { buildEventIcs, _internal } = require('../../../src/lib/ical');

describe('ical.buildEventIcs', () => {
  const baseEvent = {
    eventId: 'evt-123',
    title: 'Book Club Meeting',
    description: 'Discuss chapters 1-3',
    location: 'Library Room 2',
    dateTime: '2026-06-01T18:00:00.000Z',
  };

  test('emits a well-formed VCALENDAR/VEVENT block', () => {
    const ics = buildEventIcs(baseEvent, { clubName: 'Readers', durationMinutes: 90 });

    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//BookClub App//Events 1.0//EN');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('UID:evt-123@bookclub-app');
    expect(ics).toContain('DTSTART:20260601T180000Z');
    expect(ics).toContain('DTEND:20260601T193000Z');
    expect(ics).toContain('SUMMARY:Book Club Meeting');
    expect(ics).toContain('LOCATION:Library Room 2');
  });

  test('defaults duration to 60 minutes', () => {
    const ics = buildEventIcs(baseEvent);
    expect(ics).toContain('DTSTART:20260601T180000Z');
    expect(ics).toContain('DTEND:20260601T190000Z');
  });

  test('escapes special TEXT characters per RFC 5545', () => {
    const ics = buildEventIcs(
      { ...baseEvent, title: 'A; B, C\\D', description: 'line1\nline2' },
    );
    expect(ics).toContain('SUMMARY:A\\; B\\, C\\\\D');
    expect(ics).toContain('DESCRIPTION:line1\\nline2');
  });

  test('omits optional fields when missing', () => {
    const ics = buildEventIcs({
      eventId: 'e1',
      title: 'Solo',
      dateTime: '2026-06-01T18:00:00.000Z',
    });
    expect(ics).toContain('SUMMARY:Solo');
    expect(ics).not.toMatch(/^DESCRIPTION:/m);
    expect(ics).not.toMatch(/^LOCATION:/m);
    expect(ics).not.toMatch(/^URL:/m);
  });

  test('includes URL and club name in description when provided', () => {
    const ics = buildEventIcs(baseEvent, {
      clubName: 'Readers United',
      eventUrl: 'https://example.com/clubs/abc/events',
    });
    expect(ics).toContain('URL:https://example.com/clubs/abc/events');
    expect(ics).toContain('Club: Readers United');
  });

  test('throws on invalid event input', () => {
    expect(() => buildEventIcs(null)).toThrow();
    expect(() => buildEventIcs({ eventId: 'e1' })).toThrow();
    expect(() => buildEventIcs({ dateTime: '2026-01-01T00:00:00Z' })).toThrow();
  });

  describe('internals', () => {
    test('formatUtc pads single-digit values', () => {
      expect(_internal.formatUtc('2026-01-02T03:04:05.000Z')).toBe('20260102T030405Z');
    });

    test('foldLine folds at 75 octets with continuation whitespace', () => {
      const long = 'A'.repeat(200);
      const folded = _internal.foldLine(long);
      const segments = folded.split('\r\n');
      expect(segments[0].length).toBe(75);
      // Continuation lines start with a space and are <=75 chars total
      segments.slice(1).forEach((seg) => {
        expect(seg.startsWith(' ')).toBe(true);
        expect(seg.length).toBeLessThanOrEqual(75);
      });
      // Round-trip: stripping CRLF + leading space yields original
      expect(folded.replace(/\r\n /g, '')).toBe(long);
    });
  });
});
