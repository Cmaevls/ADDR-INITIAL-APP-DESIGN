/* ==========================================================
   ADDR app – sample data
   ----------------------------------------------------------
   Everything in this file is DEMO data so the app can be
   shown before the units are built and connected.

   Each drain has its own ADDR unit (a "node") with its own
   ESP32. When the units are connected, replace these values
   with the real readings each ESP32 sends (for example, from
   a cloud database the units upload to). The rest of the app
   only uses the names defined here.
   ========================================================== */

const AREA = 'Bauan, Batangas';

// Every drain grate is the same size
const GRATE_SIZE = '3 × 2 ft (91 × 61 cm)';

// One entry per ADDR unit (node).
// Replace "Site A/B/C" with the real locations once the drains are chosen.
const UNITS = [
  {
    id: 1, name: 'Drain 1', site: 'Site A',
    battery: 82,          // percent
    basket: 17,           // cleaning cycles since the basket was emptied
    waterLevel: 4,        // cm of water on top of the grate
    waterFlow: 18,        // L/min going into the drain
    nearestObject: 42,    // cm, from the ultrasonic sensor
    lastCleaned: '14:32',
    // water level every 15 min from 09:00 to 14:45 (last value = now)
    history: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 5, 6, 8, 9, 9, 6, 4, 3, 3, 4, 4]
  },
  {
    id: 2, name: 'Drain 2', site: 'Site B',
    battery: 76, basket: 6, waterLevel: 3, waterFlow: 16, nearestObject: 38, lastCleaned: '13:05',
    history: [1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 7, 6, 5, 4, 3, 3, 3, 3, 3]
  },
  {
    id: 3, name: 'Drain 3', site: 'Site C',
    battery: 91, basket: 11, waterLevel: 2, waterFlow: 20, nearestObject: 51, lastCleaned: '11:48',
    history: [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 5, 5, 4, 3, 2, 2, 2, 2, 2]
  }
];

// DEMO: a few seconds after signing in, this drain gets blocked,
// the app sends a notification, and the unit cleans itself.
const DEMO_BLOCKAGE = {
  unitId: 2,
  afterSeconds: 6,
  waterLevel: 9,        // cm, water backing up on the grate
  waterFlow: 3,         // L/min, almost nothing going in
  debrisDistance: 6     // cm, object seen by the ultrasonic sensor
};

// Reading while debris is on the grate during a normal cycle
const DEBRIS_DISTANCE_CM = 9;
const SLOWED_FLOW = 11;

// Chart settings
const HISTORY_END = { hour: 14, minute: 45 };
const HISTORY_STEP_MIN = 15;
const CHART_MAX_CM = 12;

// Cleaning cycles done today (newest first)
// [time, unitId, trigger, reason, duration, completed?]
const CYCLE_LOG = [
  ['14:32', 1, 'Auto', 'Debris detected', '13 s', true],
  ['14:05', 1, 'Manual', 'Run from app', '12 s', true],
  ['13:52', 1, 'Auto', 'Debris detected', '20 s', false],
  ['13:31', 3, 'Auto', 'Water backing up', '14 s', true],
  ['13:24', 3, 'Auto', 'Debris detected', '12 s', true],
  ['13:05', 2, 'Auto', 'Debris detected', '11 s', true],
  ['11:48', 3, 'Auto', 'Debris detected', '12 s', true],
  ['09:40', 1, 'Auto', 'Debris detected', '11 s', true],
  ['07:15', 2, 'Auto', 'Water backing up', '15 s', true]
];

// Average time from detection to motor start (seconds)
const AVG_RESPONSE_S = 3.4;

// Alerts that already happened
// sev: 'crit' (critical), 'warn' (warning) or 'info'
const PAST_ALERTS = [
  { unitId: 1, sev: 'crit', title: 'Rake jam detected', text: 'Motor ran 20 s without reaching the end switch, so it stopped for safety.', when: 'Today 13:52', result: 'Cleared on site at 14:05' },
  { unitId: 3, sev: 'warn', title: 'Water reached 9 cm', text: 'Two cleaning cycles ran. Back to normal by 13:45.', when: 'Today 13:00', result: 'Resolved on its own' },
  { unitId: 2, sev: 'warn', title: 'Debris still there after 3 cycles', text: 'The object may be too large for the rake.', when: 'Yesterday 16:22', result: 'Removed by hand at 16:40' },
  { unitId: 3, sev: 'info', title: 'Unit offline for 12 min', text: 'Wi-Fi signal was lost, then came back.', when: 'Yesterday 06:05', result: 'Reconnected' }
];
