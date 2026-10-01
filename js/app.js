/* ==========================================================
   ADDR app – screens and behavior
   ----------------------------------------------------------
   How it works:
   1. "state" holds everything that can change on screen.
   2. render() draws the current screen from "state".
   3. Buttons have a data-action (or data-go for navigation).
      Clicking one changes "state" and calls render() again.

   Each drain has its own ADDR unit (node). The app watches
   all of them and sends a notification when one is blocked.

   The cleaning cycle and the blockage are a DEMO: they run on
   timers. On the real units these come from each ESP32
   (sensors + limit switches).
   ========================================================== */

'use strict';

// ---------- App state ----------
const state = {
  screen: 'login',          // login | home | unit | sensors | alerts | log | settings
  unitId: 1,                // the drain being viewed
  units: UNITS.map((u) => ({ ...u, history: u.history.slice(), phase: 'idle', blocked: false })),
  capacity: 20,             // cycles before a basket counts as full
  limits: { water: 8, flow: 5, debris: 15, motor: 20 },
  notify: { blocked: true, jam: true, basket: true, daily: false },
  newLog: [],               // cycles that happened during this session (newest first)
  newEvents: [],            // alerts resolved during this session (newest first)
  pickedBar: null           // which bar of the chart is selected
};

const PHASES = ['detect', 'lift', 'drop', 'return'];
const STEP_NAMES = ['Detect', 'Lift', 'Drop', 'Return'];

const PHASE_TEXT = {
  detect: ['Debris detected', 'Ultrasonic sensor found an object on the grate'],
  lift:   ['Lifting debris', 'Conveyor rake is running'],
  drop:   ['Dropping into basket', 'End limit switch reached'],
  return: ['Returning to standby', 'Waiting for home limit switch']
};

const RAKE_TEXT = {
  idle:   ['Home', 'Ready'],
  detect: ['Home', 'Starting'],
  lift:   ['Lifting', 'Running'],
  drop:   ['At end', 'Running'],
  return: ['Returning', 'Running']
};

// Demo timing for each step (milliseconds after the cycle starts)
const CYCLE_TIMING = [
  { at: 1400, phase: 'lift' },
  { at: 4200, phase: 'drop' },
  { at: 5600, phase: 'return' },
  { at: 7400, phase: 'idle' }
];

// ---------- Icons (simple line icons) ----------
const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  crit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.7s-6 6.6-6 11.3a6 6 0 0 0 12 0c0-4.7-6-11.3-6-11.3z"/></svg>',
  flow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
  sensor: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/></svg>',
  rake: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="14" r="3"/><circle cx="18" cy="14" r="3"/><path d="M6 11h12M6 17h12M9 7l3-3 3 3"/></svg>',
  basket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18l-2 11H5z"/><path d="M8 9l2-5M16 9l-2-5M9 13v4M12 13v4M15 13v4"/></svg>',
  battery: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M5 10v4M8 10v4M11 10v4M14 10v4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>'
};

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
const unitById = (id) => state.units.find((u) => u.id === id);
const selectedUnit = () => unitById(state.unitId);
const where = (u) => `${u.name} · ${u.site}`;

function statusLabel(kind, text) {
  const icon = kind === 'ok' ? ICON.check : kind === 'crit' ? ICON.crit : ICON.warn;
  return `<span class="status is-${kind}">${icon}<span>${text}</span></span>`;
}

// Time label for a chart bar, e.g. index 23 -> "14:45"
function barTime(index, length) {
  const end = HISTORY_END.hour * 60 + HISTORY_END.minute;
  const minutes = end - (length - 1 - index) * HISTORY_STEP_MIN;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Current readings of one unit (changes while blocked or cleaning)
function readingsOf(u) {
  const running = u.phase !== 'idle';
  const step = PHASES.indexOf(u.phase);
  if (u.blocked) {
    return { running, step, water: DEMO_BLOCKAGE.waterLevel, flow: DEMO_BLOCKAGE.waterFlow, debrisSeen: true, distance: DEMO_BLOCKAGE.debrisDistance };
  }
  const debrisSeen = u.phase === 'detect' || u.phase === 'lift';
  return {
    running, step,
    water: u.waterLevel,
    flow: running && step <= 1 ? SLOWED_FLOW : u.waterFlow,
    debrisSeen,
    distance: debrisSeen ? DEBRIS_DISTANCE_CM : u.nearestObject
  };
}

function basketOf(u) {
  const full = u.basket >= state.capacity;
  const almostFull = !full && u.basket >= Math.ceil(state.capacity * 0.85);
  return { full, almostFull, kind: full ? 'crit' : almostFull ? 'warn' : 'ok', word: full ? 'Full' : almostFull ? 'Almost full' : 'OK' };
}

// Overall status of one unit, for lists and the header
function statusOf(u) {
  const b = basketOf(u);
  if (u.phase !== 'idle') return { kind: 'warn', word: 'Cleaning' };
  if (u.blocked) return { kind: 'crit', word: 'Obstructed' };
  if (b.full) return { kind: 'crit', word: 'Basket full' };
  if (b.almostFull) return { kind: 'warn', word: 'Basket almost full' };
  return { kind: 'ok', word: 'Clear' };
}

function activeAlerts() {
  const list = [];
  state.units.forEach((u) => {
    if (u.blocked) {
      list.push({
        unit: u, sev: 'crit', icon: ICON.drop, title: 'Grate obstructed',
        text: `Water at ${DEMO_BLOCKAGE.waterLevel} cm and barely draining. ${u.phase !== 'idle' ? 'Auto-cleaning is running.' : 'Auto-cleaning is starting.'}`,
        button: `Open ${u.name}`, action: 'open-unit'
      });
    }
    const b = basketOf(u);
    if (b.full || b.almostFull) {
      list.push({
        unit: u, sev: b.kind, icon: ICON.basket, title: b.full ? 'Basket full' : 'Basket almost full',
        text: b.full
          ? `${u.basket} of ${state.capacity} cycles. Cleaning is paused until the basket is emptied.`
          : `${u.basket} of ${state.capacity} cycles since it was last emptied. Please empty it soon.`,
        button: 'Mark as emptied', action: 'empty-basket'
      });
    }
  });
  return list.sort((a, b) => (a.sev === 'crit' ? -1 : 0) - (b.sev === 'crit' ? -1 : 0));
}

function backButton(label, target) {
  return `<button type="button" class="back" data-go="${target}" aria-label="${label}">${ICON.back}</button>`;
}

// ==========================================================
// Screens
// ==========================================================

function renderLogin() {
  return `
    <section class="login-hero">
      <div class="wordmark" role="img" aria-label="ADDR">
        <svg class="lambda" viewBox="0 0 22 23" aria-hidden="true"><path d="M1.5 22.5 11 1.5l9.5 21"/></svg>
        <span class="letters">DDR</span>
        <svg class="waves" viewBox="0 0 46 28" aria-hidden="true">
          <path d="M3 9C11 1 18 1 24 9s12 8 19-2" stroke="#34D3DE"/>
          <path d="M3 19c8-8 15-8 21 0s12 8 19-2" stroke="#4FA3C7"/>
        </svg>
      </div>
      <p class="login-kicker">Automated Drainage Debris Removal System</p>
      <img src="img/addr-unit.jpg" alt="ADDR unit with solar panel, conveyor rake and side basket">
      <p class="login-tagline">Cleaner drains, safer communities.</p>
    </section>
    <form class="login-form" data-form="login" novalidate>
      <h1>Sign in</h1>
      <div class="field">
        <label for="username">Username</label>
        <input id="username" type="text" autocomplete="username" placeholder="Enter your username">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" placeholder="Enter your password">
      </div>
      <button type="submit" class="btn btn-primary">Sign in</button>
      <p class="login-note">For authorized barangay and MDRRMO personnel only.</p>
    </form>`;
}

// Home: all drains at a glance
function renderHome() {
  const units = state.units;
  const blocked = units.filter((u) => u.blocked);
  const cleaning = units.filter((u) => u.phase !== 'idle' && !u.blocked);
  const clearCount = units.filter((u) => statusOf(u).kind !== 'crit' && u.phase === 'idle').length;

  let chip, title, sub;
  if (blocked.length) {
    const u = blocked[0];
    chip = '<span class="chip alarm"><span class="dot"></span>OBSTRUCTED</span>';
    title = `${u.name} is obstructed`;
    sub = `${u.site} · ${u.phase !== 'idle' ? 'auto-cleaning running' : 'auto-cleaning starting'}`;
  } else if (cleaning.length) {
    chip = '<span class="chip cleaning"><span class="dot"></span>CLEANING</span>';
    title = `${cleaning[0].name} is cleaning`;
    sub = `${cleaning[0].site} · ${PHASE_TEXT[cleaning[0].phase][0].toLowerCase()}`;
  } else {
    chip = '<span class="chip standby"><span class="dot"></span>ALL CLEAR</span>';
    title = `All ${units.length} drains are clear`;
    sub = 'Water is draining normally';
  }

  const cards = units.map((u) => {
    const s = statusOf(u);
    const r = readingsOf(u);
    return `
      <button type="button" class="unit-card ${s.kind === 'crit' ? 'is-alarm' : ''}" data-action="open-unit" data-unit="${u.id}">
        <span class="unit-top">
          <span class="unit-name"><strong>${u.name}</strong><span>${ICON.pin}${u.site}</span></span>
          ${statusLabel(s.kind, s.word)}
          <span class="chev">${ICON.next}</span>
        </span>
        <span class="unit-stats">
          <span><b>${r.water} cm</b>Water</span>
          <span><b>${r.flow} L/min</b>Flow</span>
          <span><b>${u.basket}/${state.capacity}</b>Basket</span>
          <span><b>${u.battery}%</b>Battery</span>
        </span>
      </button>`;
  }).join('');

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">Drains</h1>
        <p class="page-sub">${AREA} · ${units.length} units</p>
      </div>
      <div class="pill"><span><span class="dot"></span>All online</span></div>
    </header>

    <section class="overview" aria-label="Summary">
      <div class="overview-text">
        ${chip}
        <h2 class="hero-title">${title}</h2>
        <p class="hero-sub">${sub}</p>
        <p class="overview-counts"><span>${clearCount} clear</span><span>${blocked.length} obstructed</span><span>0 offline</span></p>
      </div>
      <img src="img/addr-unit.jpg" alt="">
    </section>

    <h2 class="section-label">Units</h2>
    <section class="unit-list" aria-label="Units">${cards}</section>`;
}

// One drain: live status and controls
function renderUnit() {
  const u = selectedUnit();
  const r = readingsOf(u);
  const b = basketOf(u);
  const s = state;

  let chip, heroTitle, heroSub;
  if (r.running) {
    chip = '<span class="chip cleaning"><span class="dot"></span>CLEANING</span>';
    [heroTitle, heroSub] = PHASE_TEXT[u.phase];
  } else if (u.blocked) {
    chip = '<span class="chip alarm"><span class="dot"></span>OBSTRUCTED</span>';
    heroTitle = 'Grate obstructed';
    heroSub = `Water at ${r.water} cm · auto-cleaning starting`;
  } else {
    chip = '<span class="chip standby"><span class="dot"></span>STANDBY</span>';
    heroTitle = 'Grate clear';
    heroSub = 'Standby · rake at home position';
  }
  const [rakeValue, rakeNote] = RAKE_TEXT[u.phase];

  const steps = STEP_NAMES.map((name, i) => {
    const cls = i === r.step ? 'active' : (r.running && i < r.step ? 'done' : '');
    return `<li class="${cls}">${name}</li>`;
  }).join('');

  const waterOk = r.water < s.limits.water;
  const flowOk = r.flow >= s.limits.flow;
  const basketColor = { ok: 'var(--teal)', warn: 'var(--amber)', crit: 'var(--red)' }[b.kind];
  const basketPct = Math.min(u.basket / s.capacity, 1) * 100;
  const runLabel = r.running ? 'Cycle running…' : b.full ? 'Empty the basket first' : 'Run cleaning cycle';

  return `
    <header class="page-header">
      <div class="title-with-back">
        ${backButton('Back to all drains', 'home')}
        <div>
          <h1 class="page-title">${u.name}</h1>
          <p class="page-sub">${u.site} · ${AREA}</p>
        </div>
      </div>
      <div class="pill" aria-label="Online. Battery ${u.battery} percent.">
        <span><span class="dot"></span>Online</span>
        <span class="divider"></span>
        <span>${ICON.battery}${u.battery}%</span>
      </div>
    </header>

    <section class="hero" aria-label="Unit status">
      <div class="hero-top">
        ${chip}
        <span class="hero-updated">Updated 5 s ago</span>
      </div>
      <img src="img/addr-unit.jpg" alt="ADDR unit">
      <div>
        <h2 class="hero-title">${heroTitle}</h2>
        <p class="hero-sub">${heroSub}</p>
      </div>
      <ol class="steps" aria-label="Cleaning cycle steps">${steps}</ol>
    </section>

    <div class="tiles-head">
      <h2 class="section-label">Sensors</h2>
      <button type="button" class="link" data-go="sensors">Details ${ICON.next}</button>
    </div>
    <section class="tiles" aria-label="Sensor readings">
      <div class="tile">
        <span class="tile-label">${ICON.drop}Water level</span>
        <span class="tile-value">${r.water} cm</span>
        ${statusLabel(waterOk ? 'ok' : 'warn', waterOk ? 'Normal' : 'High')}
      </div>
      <div class="tile">
        <span class="tile-label">${ICON.flow}Water flow</span>
        <span class="tile-value">${r.flow} L/min</span>
        ${statusLabel(flowOk ? 'ok' : 'warn', flowOk ? 'Flowing' : 'Low')}
      </div>
      <div class="tile">
        <span class="tile-label">${ICON.sensor}Debris sensor</span>
        <span class="tile-value">${r.debrisSeen ? 'Detected' : 'Clear'}</span>
        ${statusLabel(r.debrisSeen ? 'warn' : 'ok', r.debrisSeen ? `Object at ${r.distance} cm` : `None within ${s.limits.debris} cm`)}
      </div>
      <div class="tile">
        <span class="tile-label">${ICON.rake}Rake</span>
        <span class="tile-value">${rakeValue}</span>
        ${statusLabel(r.running ? 'warn' : 'ok', rakeNote)}
      </div>
    </section>

    <section class="card basket" aria-label="Debris basket">
      <div class="basket-top">
        <div class="basket-info">
          <span class="icon-box">${ICON.basket}</span>
          <div>
            <div class="basket-name">Debris basket</div>
            <div class="basket-status is-${b.kind}">${b.word} · ${u.basket}/${s.capacity} cycles</div>
          </div>
        </div>
        <button type="button" class="btn" data-action="empty-basket" data-unit="${u.id}">Mark emptied</button>
      </div>
      <div class="meter"><div class="meter-fill" style="width:${basketPct}%;background:${basketColor}"></div></div>
    </section>

    <button type="button" class="btn btn-primary" data-action="run-cycle" data-unit="${u.id}" ${r.running || b.full ? 'disabled' : ''}>
      ${ICON.play}<span>${runLabel}</span>
    </button>`;
}

// Sensor details and water history of one drain
function renderSensors() {
  const u = selectedUnit();
  const r = readingsOf(u);
  const s = state;
  const hist = u.history;
  const last = hist.length - 1;

  const bars = hist.map((cm, i) => {
    const high = cm >= s.limits.water ? ' high' : '';
    const picked = s.pickedBar === i ? ' picked' : '';
    const height = (Math.min(cm, CHART_MAX_CM) / CHART_MAX_CM) * 100;
    return `<button type="button" class="bar${high}${picked}" data-bar="${i}" aria-label="${barTime(i, hist.length)}, ${cm} cm"><span style="height:${height}%"></span></button>`;
  }).join('');

  const limitPos = (Math.min(s.limits.water, CHART_MAX_CM) / CHART_MAX_CM) * 100;
  const switchState = u.phase === 'drop' ? 'End' : (r.running && u.phase !== 'detect' ? 'Moving' : 'Home');

  const sensors = [
    ['Water-level sensor', `Alert at ${s.limits.water} cm or higher`, `${r.water} cm`,
      r.water < s.limits.water ? ['ok', 'Normal'] : ['warn', 'High']],
    ['Water-flow sensor', `Alert below ${s.limits.flow} L/min`, `${r.flow} L/min`,
      r.flow >= s.limits.flow ? ['ok', 'Normal'] : ['warn', 'Low']],
    ['Ultrasonic sensor', `Debris if closer than ${s.limits.debris} cm`, `${r.distance} cm`,
      r.debrisSeen ? ['warn', 'Debris detected'] : ['ok', 'Clear']],
    ['Limit switches', 'Home and end position', switchState, ['ok', 'Working']],
    ['Battery', 'Solar panel charging', `${u.battery}%`, ['ok', 'Good']]
  ].map(([name, note, value, [kind, word]]) => `
      <div class="row">
        <div class="row-text"><span class="row-title">${name}</span><span class="row-note">${note}</span></div>
        <div class="reading"><span class="mono">${value}</span><span class="status is-${kind}">${word}</span></div>
      </div>`).join('');

  return `
    <header class="page-header">
      <div class="title-with-back">
        ${backButton('Back to ' + u.name, 'unit')}
        <div>
          <h1 class="page-title">${u.name} sensors</h1>
          <p class="page-sub">${u.site} · updates every 5 s</p>
        </div>
      </div>
    </header>

    <section class="card chart-card" aria-label="Water above grate, last 6 hours">
      <div class="chart-head"><h2>Water above grate</h2><span class="page-sub">Last 6 hours</span></div>
      <p class="chart-readout" id="readout" aria-live="polite">${barTime(last, hist.length)} now · ${hist[last]} cm</p>
      <div class="chart" id="chart">
        <div class="chart-limit" style="bottom:${limitPos}%"></div>
        <span class="chart-limit-label" style="bottom:${limitPos}%">Alert at ${s.limits.water} cm</span>
        <div class="bars">${bars}</div>
      </div>
      <div class="chart-axis"><span>${barTime(0, hist.length)}</span><span>12:00</span><span>${barTime(last, hist.length)} now</span></div>
    </section>

    <section class="card list" aria-label="All sensors">${sensors}</section>`;
}

function renderAlerts() {
  const active = activeAlerts();
  const past = state.newEvents.concat(PAST_ALERTS);
  const level = { crit: 'Critical', warn: 'Warning', info: 'Info' };

  const activeHtml = active.length
    ? `<h2 class="section-label">Needs action</h2>` + active.map((a) => `
      <article class="alert-card ${a.sev}">
        <div class="alert-body">
          <span class="icon-box">${a.icon}</span>
          <div>
            <p class="alert-level is-${a.sev}">${level[a.sev]} · Now</p>
            <p class="alert-where">${ICON.pin}${where(a.unit)}</p>
            <h3 class="alert-title">${a.title}</h3>
            <p class="alert-text">${a.text}</p>
          </div>
        </div>
        <button type="button" class="btn btn-primary" data-action="${a.action}" data-unit="${a.unit.id}">${a.button}</button>
      </article>`).join('')
    : `<div class="card all-clear">${ICON.check}<span>All clear. Nothing needs action.</span></div>`;

  const pastHtml = past.map((p) => {
    const u = unitById(p.unitId);
    return `
      <article class="past">
        <span class="sev ${p.sev}">${ICON[p.sev]}</span>
        <div class="past-main">
          <div class="past-head"><h3>${p.title}</h3><span class="past-when">${p.when}</span></div>
          <p class="past-where">${where(u)}</p>
          <p class="past-text">${p.text}</p>
          <span class="past-res">${ICON.tick}${p.result}</span>
        </div>
      </article>`;
  }).join('');

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">Alerts</h1>
        <p class="page-sub">${active.length ? active.length + ' need action' : 'Nothing needs action'} · all drains</p>
      </div>
    </header>
    ${activeHtml}
    <h2 class="section-label">Earlier</h2>
    <section class="card list" aria-label="Earlier alerts">${pastHtml}</section>`;
}

function renderLog() {
  const cycles = state.newLog.concat(CYCLE_LOG);
  const done = cycles.filter((r) => r[5]).length;

  const rows = cycles.map(([time, unitId, trigger, reason, duration, ok]) => {
    const u = unitById(unitId);
    return `
      <div class="log-row">
        <span class="log-time">${time}</span>
        <div class="log-main">
          <span class="log-what">${u.name} · ${reason}</span>
          <span class="log-dur">${u.site} · ${trigger} · took ${duration}</span>
        </div>
        ${ok ? statusLabel('ok', 'Done') : statusLabel('crit', 'Jam')}
      </div>`;
  }).join('');

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">Cleaning log</h1>
        <p class="page-sub">Today · all ${state.units.length} drains</p>
      </div>
    </header>

    <section class="summary" aria-label="Today's summary">
      <div class="stat"><span class="stat-label">Cycles today</span><span class="stat-value">${cycles.length}</span></div>
      <div class="stat"><span class="stat-label">Completed</span><span class="stat-value">${done}<small>of ${cycles.length}</small></span></div>
      <div class="stat"><span class="stat-label">Avg. response</span><span class="stat-value">${AVG_RESPONSE_S} s</span><span class="stat-note">Detection to motor start</span></div>
      <div class="stat"><span class="stat-label">Needed a person</span><span class="stat-value">${cycles.length - done}</span><span class="stat-note">Jams or debris too large</span></div>
    </section>

    <section class="card list" aria-label="Cycles">${rows}</section>`;
}

function renderSettings() {
  const s = state;
  const limitRows = [
    ['water', 'Water alert level', 'cm', 'Alert when water on the grate reaches this'],
    ['flow', 'Low-flow alert', 'L/min', 'Alert when flow into the drain drops below this'],
    ['debris', 'Debris distance', 'cm', 'Start a cycle when something is this close'],
    ['motor', 'Max motor run time', 's', 'Stop the motor and send a jam alert after this']
  ].map(([key, label, unit, note]) => stepperRow(label, note, `${s.limits[key]} ${unit}`, `limit:${key}`)).join('');

  const notifyRows = [
    ['blocked', 'Drain obstructed'], ['jam', 'Rake jam'], ['basket', 'Basket full'], ['daily', 'Daily summary']
  ].map(([key, label]) => `
      <div class="row">
        <span class="row-title" style="font-weight:500">${label}</span>
        <button type="button" class="switch" aria-label="${label}" aria-pressed="${s.notify[key]}" data-action="toggle" data-key="${key}"></button>
      </div>`).join('');

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-sub">Applies to all ${s.units.length} units</p>
      </div>
    </header>

    <h2 class="section-label">Detection</h2>
    <section class="card list">${limitRows}</section>

    <h2 class="section-label">Notifications</h2>
    <section class="card list">${notifyRows}</section>

    <h2 class="section-label">Basket and units</h2>
    <section class="card list">
      ${stepperRow('Basket capacity', 'Cycles before it counts as full', `${s.capacity} cycles`, 'capacity')}
      <dl style="margin:0">
        <div class="kv"><dt>Units</dt><dd>${s.units.length} · one ESP32 each</dd></div>
        <div class="kv"><dt>Drain grate</dt><dd>${GRATE_SIZE}</dd></div>
        <div class="kv"><dt>Power</dt><dd>Battery + solar panel</dd></div>
        <div class="kv"><dt>Area</dt><dd>${AREA}</dd></div>
        <div class="kv"><dt>Data</dt><dd>Demo (sample values)</dd></div>
      </dl>
    </section>

    <h2 class="section-label">Demo</h2>
    <section class="card list">
      <div class="row">
        <div class="row-text"><span class="row-title">Blockage demo</span><span class="row-note">${unitById(DEMO_BLOCKAGE.unitId).name} gets blocked in ${DEMO_BLOCKAGE.afterSeconds} s</span></div>
        <button type="button" class="btn" data-action="replay-demo">Play again</button>
      </div>
    </section>

    <button type="button" class="btn btn-danger" data-action="sign-out">Sign out</button>`;
}

function stepperRow(label, note, value, key) {
  return `
      <div class="row">
        <div class="row-text"><span class="row-title">${label}</span><span class="row-note">${note}</span></div>
        <div class="stepper">
          <button type="button" aria-label="Decrease ${label}" data-action="step" data-key="${key}" data-dir="-1">${ICON.minus}</button>
          <output>${value}</output>
          <button type="button" aria-label="Increase ${label}" data-action="step" data-key="${key}" data-dir="1">${ICON.plus}</button>
        </div>
      </div>`;
}

const SCREENS = {
  login: renderLogin,
  home: renderHome,
  unit: renderUnit,
  sensors: renderSensors,
  alerts: renderAlerts,
  log: renderLog,
  settings: renderSettings
};

// Which tab is highlighted for each screen
const TAB_OF = { home: 'home', unit: 'home', sensors: 'home', alerts: 'alerts', log: 'log', settings: 'settings' };

// ==========================================================
// Drawing
// ==========================================================

function render() {
  const view = $('view');
  const scrollTop = view.scrollTop;
  view.innerHTML = SCREENS[state.screen]();
  view.classList.toggle('is-login', state.screen === 'login');
  view.scrollTop = scrollTop;

  // Tab bar
  $('tabbar').hidden = state.screen === 'login';
  document.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.go === TAB_OF[state.screen]) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });

  // Red badge on the Alerts tab
  const count = activeAlerts().length;
  const badge = $('alert-badge');
  badge.hidden = count === 0;
  badge.textContent = count;
  $('alerts-tab').setAttribute('aria-label', count ? `Alerts, ${count} need action` : 'Alerts');
}

function goTo(screen) {
  state.screen = screen;
  state.pickedBar = null;
  render();
  $('view').scrollTop = 0;
}

function openUnit(id) {
  state.unitId = id;
  goTo('unit');
}

// Small confirmation at the top ("Cycle complete")
let toastTimer = null;
function showToast(text) {
  const toast = $('toast');
  toast.innerHTML = `${ICON.tick}<span>${text}</span>`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

// Phone-style notification. Tapping it opens that drain.
let noticeTimer = null;
function sendNotification(title, text, unitId, kind) {
  const notice = $('notice');
  notice.className = `notice ${kind}`;
  notice.dataset.unit = unitId;
  notice.innerHTML = `
    <img src="img/icon-192.png" alt="">
    <span class="notice-text">
      <span class="notice-app">ADDR · now</span>
      <strong>${title}</strong>
      <span>${text}</span>
    </span>`;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 5500);
  if (navigator.vibrate) navigator.vibrate(120);
}

// ==========================================================
// Actions
// ==========================================================

const cycleTimers = {};

function runCycle(unitId, trigger, reason) {
  const u = unitById(unitId);
  if (u.phase !== 'idle' || basketOf(u).full) return;
  const wasBlocked = u.blocked;

  u.phase = 'detect';
  render();

  cycleTimers[unitId] = CYCLE_TIMING.map(({ at, phase }) => setTimeout(() => {
    u.phase = phase;

    // Debris has been lifted off the grate: water drains again
    if (phase === 'drop' && u.blocked) {
      u.blocked = false;
      u.history[u.history.length - 1] = u.waterLevel;
    }

    if (phase === 'idle') {
      u.basket = Math.min(u.basket + 1, state.capacity);
      u.lastCleaned = 'Just now';
      state.newLog.unshift(['Just now', u.id, trigger, reason, '7 s', true]);
      if (wasBlocked) {
        state.newEvents.unshift({
          unitId: u.id, sev: 'crit', title: 'Grate obstructed',
          text: `Water reached ${DEMO_BLOCKAGE.waterLevel} cm. Auto-cleaning removed the debris.`,
          when: 'Just now', result: 'Cleared automatically'
        });
        if (state.notify.blocked) sendNotification(`${where(u)} is clear again`, 'Debris removed. Water is draining normally.', u.id, 'ok');
      } else {
        showToast(`${u.name}: cycle complete · logged`);
      }
    }
    render();
  }, at));
}

// DEMO: one drain gets blocked a few seconds after signing in
let demoTimer = null;
function startBlockageDemo() {
  clearTimeout(demoTimer);
  demoTimer = setTimeout(() => {
    const u = unitById(DEMO_BLOCKAGE.unitId);
    if (u.phase !== 'idle' || state.screen === 'login') return;
    u.blocked = true;
    u.history[u.history.length - 1] = DEMO_BLOCKAGE.waterLevel;
    if (state.notify.blocked) {
      sendNotification(`${where(u)} is obstructed`, `Water at ${DEMO_BLOCKAGE.waterLevel} cm. Auto-cleaning started.`, u.id, 'alarm');
    }
    render();
    // the unit starts cleaning by itself
    setTimeout(() => runCycle(u.id, 'Auto', 'Grate obstructed'), 3000);
  }, DEMO_BLOCKAGE.afterSeconds * 1000);
}

function emptyBasket(unitId) {
  const u = unitById(unitId);
  u.basket = 0;
  state.newEvents.unshift({ unitId, sev: 'info', title: 'Basket emptied', text: 'Marked as emptied from the app.', when: 'Just now', result: 'Cycle count reset to 0' });
  render();
}

function changeSetting(key, dir) {
  const ranges = { water: [3, 12], flow: [1, 15], debris: [5, 40], motor: [10, 40], capacity: [5, 40] };
  if (key === 'capacity') {
    const [min, max] = ranges.capacity;
    state.capacity = Math.min(max, Math.max(min, state.capacity + dir));
  } else {
    const name = key.split(':')[1];
    const [min, max] = ranges[name];
    state.limits[name] = Math.min(max, Math.max(min, state.limits[name] + dir));
  }
  render();
}

function signOut() {
  clearTimeout(demoTimer);
  Object.values(cycleTimers).forEach((list) => list.forEach(clearTimeout));
  state.units.forEach((u) => { u.phase = 'idle'; u.blocked = false; });
  $('notice').hidden = true;
  goTo('login');
}

// Chart: show the value of the bar under the finger or mouse
function pickBar(index) {
  if (state.pickedBar === index) return;
  state.pickedBar = index;
  document.querySelectorAll('.bar').forEach((bar) => {
    bar.classList.toggle('picked', Number(bar.dataset.bar) === index);
  });
  const readout = $('readout');
  if (!readout) return;
  const hist = selectedUnit().history;
  const last = hist.length - 1;
  readout.textContent = index === null
    ? `${barTime(last, hist.length)} now · ${hist[last]} cm`
    : `${barTime(index, hist.length)} · ${hist[index]} cm`;
}

// ==========================================================
// Events
// ==========================================================

document.addEventListener('click', (event) => {
  const notice = event.target.closest('#notice');
  if (notice) {
    notice.hidden = true;
    openUnit(Number(notice.dataset.unit));
    return;
  }

  const nav = event.target.closest('[data-go]');
  if (nav) { goTo(nav.dataset.go); return; }

  const bar = event.target.closest('[data-bar]');
  if (bar) { pickBar(Number(bar.dataset.bar)); return; }

  const el = event.target.closest('[data-action]');
  if (!el) return;
  const unitId = Number(el.dataset.unit);
  switch (el.dataset.action) {
    case 'open-unit': openUnit(unitId); break;
    case 'run-cycle': runCycle(unitId, 'Manual', 'Run from app'); break;
    case 'empty-basket': emptyBasket(unitId); break;
    case 'step': changeSetting(el.dataset.key, Number(el.dataset.dir)); break;
    case 'toggle':
      state.notify[el.dataset.key] = !state.notify[el.dataset.key];
      render();
      break;
    case 'replay-demo':
      showToast(`${unitById(DEMO_BLOCKAGE.unitId).name} will get blocked in ${DEMO_BLOCKAGE.afterSeconds} s`);
      startBlockageDemo();
      break;
    case 'sign-out': signOut(); break;
  }
});

// Sign in (demo only: no accounts yet, any input is accepted)
document.addEventListener('submit', (event) => {
  if (event.target.dataset.form === 'login') {
    event.preventDefault();
    goTo('home');
    startBlockageDemo();
  }
});

document.addEventListener('mouseover', (event) => {
  const bar = event.target.closest('[data-bar]');
  if (bar) pickBar(Number(bar.dataset.bar));
});
document.addEventListener('focusin', (event) => {
  const bar = event.target.closest('[data-bar]');
  if (bar) pickBar(Number(bar.dataset.bar));
});
document.addEventListener('mouseout', (event) => {
  const chart = event.target.closest('#chart');
  if (chart && !chart.contains(event.relatedTarget)) pickBar(null);
});

// Start
render();
