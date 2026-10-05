const { describe, it, expect } = require('vitest');
const { parseTimeSlot, bookingDurationMinutes, slotsOverlap } = require('../../utils/time');

describe('time utils', () => {
  it('parses slot with different dash symbols', () => {
    expect(parseTimeSlot('10:00-12:30')).toMatchObject({ start: 600, end: 750 });
    expect(parseTimeSlot('10:00–12:30')).toMatchObject({ start: 600, end: 750 });
  });

  it('calculates booking duration', () => {
    expect(bookingDurationMinutes('10:00-10:45')).toBe(45);
  });

  it('detects overlaps', () => {
    expect(slotsOverlap('10:00-11:00', '10:30-12:00')).toBe(true);
    expect(slotsOverlap('10:00-11:00', '11:00-12:00')).toBe(false);
  });
});
