const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTimeSlot, hasMinimumDuration, isWorkingHours, isOverlap } = require('../../lib/time');

test('parseTimeSlot handles hyphen and en dash', () => {
  const parsedA = parseTimeSlot('10:00-11:30');
  const parsedB = parseTimeSlot('10:00–11:30');
  assert.equal(parsedA.start, 600);
  assert.equal(parsedA.end, 690);
  assert.deepEqual(parsedA, parsedB);
});

test('parseTimeSlot rejects invalid intervals', () => {
  assert.equal(parseTimeSlot('11:00-10:00'), null);
  assert.equal(parseTimeSlot('bad-value'), null);
});

test('duration/working-hours/overlap checks', () => {
  const slot = parseTimeSlot('09:00-09:29');
  assert.equal(hasMinimumDuration(slot, 30), false);

  const validSlot = parseTimeSlot('09:00-10:00');
  assert.equal(hasMinimumDuration(validSlot, 30), true);
  assert.equal(isWorkingHours(validSlot), true);
  assert.equal(isWorkingHours(parseTimeSlot('08:00-09:00')), false);

  assert.equal(isOverlap(parseTimeSlot('10:00-11:00'), parseTimeSlot('10:30-11:30')), true);
  assert.equal(isOverlap(parseTimeSlot('10:00-11:00'), parseTimeSlot('11:00-12:00')), false);
});
