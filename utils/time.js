function normalizeSlot(slot) {
  if (!slot || typeof slot !== 'string') return '';
  return slot
    .replace('с ', '')
    .replace(' до', '-')
    .replace(/[–—]/g, '-')
    .trim();
}

function parseTimeSlot(slot) {
  const cleanSlot = normalizeSlot(slot);
  const [start, end] = cleanSlot.split('-').map((item) => item && item.trim());

  if (!start || !end) return null;

  const [startHour, startMin = '0'] = start.split(':');
  const [endHour, endMin = '0'] = end.split(':');

  const sh = Number(startHour);
  const sm = Number(startMin);
  const eh = Number(endHour);
  const em = Number(endMin);

  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  if (sh < 0 || sh > 23 || eh < 0 || eh > 23 || sm < 0 || sm > 59 || em < 0 || em > 59) return null;

  return {
    start: sh * 60 + sm,
    end: eh * 60 + em,
    startStr: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
    endStr: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
  };
}

function bookingDurationMinutes(slot) {
  const parsed = parseTimeSlot(slot);
  if (!parsed) return null;
  return parsed.end - parsed.start;
}

function slotsOverlap(firstSlot, secondSlot) {
  const first = parseTimeSlot(firstSlot);
  const second = parseTimeSlot(secondSlot);
  if (!first || !second) return false;
  return first.start < second.end && first.end > second.start;
}

function toBookingDates(slot, baseDate = new Date()) {
  const parsed = parseTimeSlot(slot);
  if (!parsed) return null;

  const startDate = new Date(baseDate);
  const endDate = new Date(baseDate);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  startDate.setMinutes(parsed.start);
  endDate.setMinutes(parsed.end);

  return {
    parsed,
    startDate,
    endDate,
    formattedSlot: `${parsed.startStr}-${parsed.endStr}`,
  };
}

module.exports = {
  normalizeSlot,
  parseTimeSlot,
  bookingDurationMinutes,
  slotsOverlap,
  toBookingDates,
};
