// logic/time.js
// Provides the effective time for availability and pricing calculations.
// Supports simulated time slots for testing at any hour.

let globalSimSlot = 'lunch'; // default to lunch during off-hours so canteen is open

function setGlobalSimSlot(slot) {
  globalSimSlot = slot;
}

function getGlobalSimSlot() {
  return globalSimSlot;
}

function getEffectiveTime(req) {
  if (req) {
    const explicitTime = req.get && (req.get('X-Simulate-Time') || (req.query && req.query.simTime));
    if (explicitTime) {
      const parsed = new Date(explicitTime);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    const explicitSlot = req.get && (req.get('X-Simulate-Slot') || (req.query && req.query.simSlot));
    if (explicitSlot) {
      return timeForSlot(explicitSlot);
    }
  }

  if (globalSimSlot && globalSimSlot !== 'real') {
    return timeForSlot(globalSimSlot);
  }

  return new Date();
}

function timeForSlot(slot) {
  const d = new Date();
  switch (slot) {
    case 'breakfast':
      d.setHours(9, 15, 0, 0);
      return d;
    case 'lunch':
      d.setHours(13, 15, 0, 0);
      return d;
    case 'evening':
      d.setHours(18, 0, 0, 0);
      return d;
    case 'closed':
      d.setHours(3, 0, 0, 0);
      return d;
    case 'allday':
    default:
      d.setHours(12, 0, 0, 0);
      return d;
  }
}

module.exports = {
  getEffectiveTime,
  setGlobalSimSlot,
  getGlobalSimSlot,
};
