const SLOT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/;

function parseTimeSlot(slot) {
  if (!slot || typeof slot !== 'string') {
    return null;
  }

  const normalized = slot.trim().replace('с ', '').replace(' до', '-');
  const match = normalized.match(SLOT_REGEX);

  if (!match) {
    return null;
  }

  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  if (end <= start) {
    return null;
  }

  return {
    start,
    end,
    startStr: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
    endStr: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
  };
}

function formatTimeSlot(slot) {
  const parsed = parseTimeSlot(slot);
  if (!parsed) return null;
  return `${parsed.startStr}-${parsed.endStr}`;
}

function isWorkingHours(slot, startMinutes = 9 * 60, endMinutes = 23 * 60) {
  return slot.start >= startMinutes && slot.end <= endMinutes;
}

function hasMinimumDuration(slot, minDuration = 30) {
  return slot.end - slot.start >= minDuration;
}

function isOverlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

module.exports = {
  parseTimeSlot,
  formatTimeSlot,
  isWorkingHours,
  hasMinimumDuration,
  isOverlap,
};
