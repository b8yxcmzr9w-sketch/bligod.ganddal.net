'use strict';

// ── Konstanter ────────────────────────────────────────────────
const HOURS_NO = ['tolv','ett','to','tre','fire','fem','seks','sju','åtte','ni','ti','elleve'];
const TOTAL_Q  = 10;
const SVG_W    = 300;
const CX = 150, CY = 150, R = 120;
const NS = 'http://www.w3.org/2000/svg';

// ── Innstillinger (oppdateres fra skjema) ─────────────────────
const cfg = {
  mode:        'show-clock',
  exprStyle:   'text',
  marks:       0,       // 0 | 4 | 12  – antall streker på skiven
  showNums:    false,   // vis tall eller ikke
  showHint:    false,
  hourColor:   '#1a1a2e',
  minuteColor: '#e63946',
};

// ── Spilltilstand ─────────────────────────────────────────────
let gs       = {};
let soundOn  = true;
let timerInt = null;

function resetGs() {
  gs = { score: 0, streak: 0, bestStreak: 0, currentQ: 0, answered: false,
         taskTimes: [], taskStart: 0 };
}

// ── Stoppeklokke (per oppgave) ────────────────────────────────
function startTaskTimer() {
  clearInterval(timerInt);
  gs.taskStart = Date.now();
  const el = document.getElementById('task-timer');
  if (el) {
    el.textContent = '0,0 s';
    timerInt = setInterval(() => {
      const sec = (Date.now() - gs.taskStart) / 1000;
      el.textContent = sec.toFixed(1).replace('.', ',') + ' s';
    }, 100);
  }
}

function stopTaskTimer() {
  clearInterval(timerInt);
  const elapsed = (Date.now() - gs.taskStart) / 1000;
  gs.taskTimes.push(parseFloat(elapsed.toFixed(2)));
  const el = document.getElementById('task-timer');
  if (el) el.textContent = elapsed.toFixed(1).replace('.', ',') + ' s';
  return elapsed;
}

// ── Fanfarer (Web Audio API) ──────────────────────────────────
function playFanfare(ok) {
  if (!soundOn) return;
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const t    = ctx.currentTime;

    function tone(freq, start, dur, vol = 0.22, type = 'triangle') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.015);
      gain.gain.setValueAtTime(vol, start + dur - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    }

    if (ok) {
      // Oppadgående fanfare – C5 → E5 → G5 → akk C6+G5+E5
      tone(523,  t,        0.09);           // C5
      tone(659,  t + 0.09, 0.09);           // E5
      tone(784,  t + 0.18, 0.09);           // G5
      tone(1047, t + 0.29, 0.52);           // C6 (toppnote)
      tone(784,  t + 0.29, 0.48, 0.16);    // G5
      tone(659,  t + 0.29, 0.44, 0.12);    // E5
    } else {
      // Nedadgående «wah-wah-wah»
      tone(466, t,        0.22, 0.18, 'sawtooth');   // Bb4
      tone(415, t + 0.22, 0.22, 0.18, 'sawtooth');   // Ab4
      tone(349, t + 0.44, 0.38, 0.18, 'sawtooth');   // F4
    }

    setTimeout(() => ctx.close(), 2200);
  } catch (_) { /* nettleser støtter ikke Web Audio */ }
}

// ── Mini-klokke SVG for innstillingsvelger ────────────────────
function miniClockSVG(marks, showNums) {
  const S = 58, cx = 29, cy = 29, r = 22;
  let s = '';

  s += `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#e0e7ff"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#312e81" stroke-width="2.5"/>`;

  for (let i = 0; i < 12; i++) {
    const main = i % 3 === 0;
    const a    = (i * 30 - 90) * Math.PI / 180;
    const cos  = Math.cos(a), sin = Math.sin(a);

    if (marks === 12 || (marks === 4 && main)) {
      const ox = cx + (r - 1.5) * cos, oy = cy + (r - 1.5) * sin;
      const ix = cx + (r - (main ? 6.5 : 3.5)) * cos, iy = cy + (r - (main ? 6.5 : 3.5)) * sin;
      s += `<line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ix.toFixed(1)}" y2="${iy.toFixed(1)}" stroke="#333" stroke-width="${main ? 2 : 1}" stroke-linecap="round"/>`;
    }

    if (showNums && (marks === 12 || main)) {
      const nr  = r - (marks === 12 ? 9 : 10);
      const nx  = cx + nr * cos, ny = cy + nr * sin;
      const num = i === 0 ? 12 : i;
      const fs  = marks === 12 ? 5.5 : 8;
      s += `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="${main ? 700 : 400}" fill="#312e81" font-family="system-ui">${num}</text>`;
    }
  }

  // Visere – statisk 10:10 for å se naturlig ut
  const hA = 215 * Math.PI / 180, mA = -30 * Math.PI / 180;
  const hL = r * 0.52, mL = r * 0.80;
  s += `<line x1="${(cx-hL*.15*Math.cos(hA)).toFixed(1)}" y1="${(cy-hL*.15*Math.sin(hA)).toFixed(1)}" x2="${(cx+hL*Math.cos(hA)).toFixed(1)}" y2="${(cy+hL*Math.sin(hA)).toFixed(1)}" stroke="#1e1b4b" stroke-width="2.5" stroke-linecap="round"/>`;
  s += `<line x1="${(cx-mL*.15*Math.cos(mA)).toFixed(1)}" y1="${(cy-mL*.15*Math.sin(mA)).toFixed(1)}" x2="${(cx+mL*Math.cos(mA)).toFixed(1)}" y2="${(cy+mL*Math.sin(mA)).toFixed(1)}" stroke="#e63946" stroke-width="1.8" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="2.2" fill="#1e1b4b"/>`;

  return `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

function buildMarksPicker() {
  const picker = document.getElementById('marks-picker');
  if (!picker) return;
  picker.innerHTML = '';
  [[0, 'Ingen'], [4, '4'], [12, '12']].forEach(([m, lbl]) => {
    const opt = document.createElement('div');
    opt.className = 'face-option' + (cfg.marks === m ? ' selected' : '');
    opt.innerHTML = miniClockSVG(m, cfg.showNums) + `<span class="face-label">${lbl}</span>`;
    opt.addEventListener('click', () => {
      cfg.marks = m;
      buildFaceOptions();
    });
    picker.appendChild(opt);
  });
}

function buildNumsPicker() {
  const picker = document.getElementById('nums-picker');
  if (!picker) return;
  picker.innerHTML = '';
  [[false, 'Uten tall'], [true, 'Med tall']].forEach(([sn, lbl]) => {
    const opt = document.createElement('div');
    opt.className = 'face-option' + (cfg.showNums === sn ? ' selected' : '');
    opt.innerHTML = miniClockSVG(cfg.marks, sn) + `<span class="face-label">${lbl}</span>`;
    opt.addEventListener('click', () => {
      cfg.showNums = sn;
      buildNumsPicker();
    });
    picker.appendChild(opt);
  });
}

function buildFaceOptions() {
  buildMarksPicker();
  buildNumsPicker();
}

// ── Tid og uttrykk ────────────────────────────────────────────
function getExpr(h, m) {
  const c = HOURS_NO[h % 12];
  const n = HOURS_NO[(h % 12 + 1) % 12];
  return [
    `klokka ${c}`,
    `fem over ${c}`,
    `ti over ${c}`,
    `kvart over ${c}`,
    `ti på halv ${n}`,
    `fem på halv ${n}`,
    `halv ${n}`,
    `fem over halv ${n}`,
    `ti over halv ${n}`,
    `kvart på ${n}`,
    `ti på ${n}`,
    `fem på ${n}`,
  ][m / 5];
}

function rndTime() {
  return { hour: Math.floor(Math.random() * 12) + 1, minute: Math.floor(Math.random() * 12) * 5 };
}

// ── Tale (Web Speech API) ─────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = 'nb-NO';
  utt.rate   = 0.85;
  window.speechSynthesis.speak(utt);
}

function getDigital(h, m) {
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function getLabel(h, m) {
  return cfg.exprStyle === 'digital' ? getDigital(h, m) : getExpr(h, m);
}

function makeChoices(h, m) {
  const correct = getLabel(h, m);
  const pool = new Set([correct]);
  let guard = 0;
  while (pool.size < 4 && guard++ < 100) {
    const t = rndTime();
    if (t.hour !== h || t.minute !== m) pool.add(getLabel(t.hour, t.minute));
  }
  return [...pool].sort(() => Math.random() - 0.5);
}

// ── SVG-hjelper ───────────────────────────────────────────────
function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function drawHand(svg, angle, len, w, color) {
  svg.appendChild(svgEl('line', {
    x1: CX - len * 0.12 * Math.cos(angle), y1: CY - len * 0.12 * Math.sin(angle),
    x2: CX + len * Math.cos(angle),         y2: CY + len * Math.sin(angle),
    stroke: color, 'stroke-width': w, 'stroke-linecap': 'round',
  }));
}

function drawClock(svg, h, m, s) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_W}`);
  svg.setAttribute('width', '260');
  svg.setAttribute('height', '260');

  // Bakgrunn / kant
  svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: R + 7, fill: '#e0e7ff', stroke: 'none' }));
  svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'white', stroke: '#312e81', 'stroke-width': '4' }));

  // Streker og tall
  for (let i = 0; i < 12; i++) {
    const a    = (i * 30 - 90) * Math.PI / 180;
    const main = i % 3 === 0;

    if (cfg.marks === 12 || (cfg.marks === 4 && main)) {
      svg.appendChild(svgEl('line', {
        x1: CX + (R - 4)                  * Math.cos(a), y1: CY + (R - 4)                  * Math.sin(a),
        x2: CX + (R - (main ? 16 : 9))    * Math.cos(a), y2: CY + (R - (main ? 16 : 9))    * Math.sin(a),
        stroke: '#444', 'stroke-width': main ? '3' : '1.5', 'stroke-linecap': 'round',
      }));
    }

    const showNum = cfg.showNums && (cfg.marks === 12 || main);
    if (showNum) {
      const nr  = R - (main ? 28 : 20);
      const txt = svgEl('text', {
        x: CX + nr * Math.cos(a), y: CY + nr * Math.sin(a),
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': main ? '18' : '13', 'font-weight': main ? '700' : '400',
        fill: '#312e81', 'font-family': 'system-ui, sans-serif',
      });
      txt.textContent = i === 0 ? 12 : i;
      svg.appendChild(txt);
    }
  }

  // Minutt-streker (60) – bare ved 12 markeringer
  if (cfg.marks === 12) {
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const a = (i * 6 - 90) * Math.PI / 180;
      svg.appendChild(svgEl('line', {
        x1: CX + (R - 4) * Math.cos(a), y1: CY + (R - 4) * Math.sin(a),
        x2: CX + (R - 7) * Math.cos(a), y2: CY + (R - 7) * Math.sin(a),
        stroke: '#c7d2fe', 'stroke-width': '1',
      }));
    }
  }

  // Visere
  const ha = ((h % 12 + m / 60) * 30 - 90) * Math.PI / 180;
  const ma = (m * 6 - 90) * Math.PI / 180;
  drawHand(svg, ha, R * 0.55, 6, cfg.hourColor);
  drawHand(svg, ma, R * 0.82, 4, cfg.minuteColor);


  // Midtpunkt
  svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: '5', fill: '#312e81' }));
}

// ── Interaktiv klokke ─────────────────────────────────────────
function bindInteractive(svg, onChange) {
  let active = false;

  function minuteFromEvent(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const dx   = (clientX - rect.left) * (SVG_W / rect.width)  - CX;
    const dy   = (clientY - rect.top)  * (SVG_W / rect.height) - CY;
    let   deg  = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;
    const m = Math.round(deg / 30) * 5;
    return m >= 60 ? 0 : m;
  }

  function coords(e) {
    return e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
  }

  svg.addEventListener('mousedown', e => {
    active = true;
    onChange(minuteFromEvent(...coords(e)));
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (active) onChange(minuteFromEvent(...coords(e)));
  });
  document.addEventListener('mouseup', () => { active = false; });

  svg.addEventListener('touchstart', e => {
    active = true;
    onChange(minuteFromEvent(...coords(e)));
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', e => {
    if (active) { onChange(minuteFromEvent(...coords(e))); e.preventDefault(); }
  }, { passive: false });
  document.addEventListener('touchend', () => { active = false; });
}

// ── Skjermbytte ───────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── HUD ───────────────────────────────────────────────────────
function updateHud() {
  document.getElementById('score').textContent        = gs.score;
  document.getElementById('streak-display').textContent = gs.streak >= 3 ? `🔥 ${gs.streak}` : '';
  document.getElementById('task-counter').textContent = `${gs.currentQ} / ${TOTAL_Q}`;
}

// ── Tilbakemelding ────────────────────────────────────────────
const CORRECT_MSG = ['Riktig! 🎉', 'Flott! ✨', 'Bra! 👏', 'Perfekt! 🌟', 'Ja! 🎯'];
const WRONG_MSG   = ['Feil.', 'Nesten!', 'Prøv igjen neste gang.'];

function showFeedback(ok, correctExpr) {
  const el  = document.getElementById('feedback');
  const pfx = (ok ? CORRECT_MSG : WRONG_MSG)[Math.floor(Math.random() * (ok ? 5 : 3))];
  el.textContent = ok ? pfx : `${pfx} Riktig svar: ${correctExpr}`;
  el.className   = `feedback ${ok ? 'correct' : 'wrong'}`;
}

// ── Poeng og neste-knapp ──────────────────────────────────────
function registerAnswer(ok, correctExpr) {
  stopTaskTimer();
  playFanfare(ok);
  if (ok) {
    gs.score++;
    gs.streak++;
    if (gs.streak > gs.bestStreak) gs.bestStreak = gs.streak;
  } else {
    gs.streak = 0;
  }
  showFeedback(ok, correctExpr);
  updateHud();

  const nextBtn = document.getElementById('next-btn');
  nextBtn.textContent = gs.currentQ >= TOTAL_Q ? 'Se resultat →' : 'Neste →';
  nextBtn.classList.remove('hidden');
}

// ── Neste spørsmål ────────────────────────────────────────────
function nextQ() {
  gs.currentQ++;
  if (gs.currentQ > TOTAL_Q) { showResult(); return; }

  gs.answered = false;
  document.getElementById('feedback').className   = 'feedback hidden';
  document.getElementById('next-btn').classList.add('hidden');
  updateHud();

  const { hour, minute } = rndTime();
  const mode = cfg.mode === 'both'
    ? (Math.random() < 0.5 ? 'show-clock' : 'show-expression')
    : cfg.mode;

  mode === 'show-clock'
    ? buildClockTask(hour, minute)
    : buildExprTask(hour, minute);

  startTaskTimer();
}

// ── Modus 1: vis klokke, velg uttrykk ────────────────────────
function buildClockTask(h, m) {
  const area = document.getElementById('task-area');
  area.innerHTML = '';

  const svg  = document.createElementNS(NS, 'svg');
  svg.id     = 'clock-svg';
  const wrap = document.createElement('div');
  wrap.className = 'clock-wrap';
  wrap.appendChild(svg);

  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'choices';
  const correct = getLabel(h, m);
  const isDigital = cfg.exprStyle === 'digital';

  makeChoices(h, m).forEach(ch => {
    // Wrapper – brukes som grid-celle
    const row = document.createElement('div');
    row.className = 'choice-row';

    // Høyttalerknapp (bare i tekstmodus)
    if (!isDigital) {
      const spk = document.createElement('button');
      spk.className   = 'speak-btn';
      spk.textContent = '🔊';
      spk.title       = 'Hør uttrykket';
      spk.setAttribute('aria-label', `Les opp: ${ch}`);
      spk.addEventListener('click', () => speak(ch));
      row.appendChild(spk);
    }

    // Svarknapp
    const btn = document.createElement('button');
    btn.className   = isDigital ? 'choice-btn digital' : 'choice-btn';
    btn.textContent = ch;
    btn.addEventListener('click', () => {
      if (gs.answered) return;
      gs.answered = true;
      // Marker riktig/feil på alle knapper
      choicesDiv.querySelectorAll('.choice-btn').forEach(b => {
        b.disabled = true;
        if (b.textContent === correct)                    b.classList.add('correct');
        else if (b.textContent === ch && ch !== correct) b.classList.add('wrong');
      });
      // Deaktiver alle høyttaler-knapper
      choicesDiv.querySelectorAll('.speak-btn').forEach(b => { b.disabled = true; });
      registerAnswer(ch === correct, correct);
    });
    row.appendChild(btn);
    choicesDiv.appendChild(row);
  });

  area.appendChild(wrap);
  area.appendChild(choicesDiv);

  drawClock(svg, h, m);
}

// ── Modus 2: vis uttrykk / digital tid, still klokke ─────────
function buildExprTask(h, m) {
  const area    = document.getElementById('task-area');
  area.innerHTML = '';
  const correct    = getLabel(h, m);
  const isDigital  = cfg.exprStyle === 'digital';
  let   selM       = 0;

  // Vis-kort – norsk tekst eller digital
  const card = document.createElement('div');
  const display = isDigital
    ? `<div class="digital-display">${correct}</div>`
    : `<div class="expr-text">${correct}</div>`;

  if (isDigital) {
    card.className = 'expr-card';
    card.innerHTML = `${display}<small>Dra minuttviserviseren til riktig posisjon</small>`;
  } else {
    // Tekstmodus: kortet er klikkbart for opplesing
    card.className = 'expr-card speakable';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = 'Trykk for å høre';
    card.innerHTML = `${display}
      <small>🔊 Trykk for å høre &nbsp;·&nbsp; Dra klokka til riktig tid</small>`;
    card.addEventListener('click', () => speak(correct));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') speak(correct); });
  }
  area.appendChild(card);

  // Klokke
  const svg  = document.createElementNS(NS, 'svg');
  svg.id     = 'clock-svg';
  svg.classList.add('interactive');
  const wrap = document.createElement('div');
  wrap.className = 'clock-wrap';
  wrap.appendChild(svg);
  area.appendChild(wrap);

  // Sanntidshint (vises bare om innstilling er på)
  const hint = document.createElement('div');
  hint.className = 'current-hint';
  hint.innerHTML = `Du viser nå: <strong>${getLabel(h, 0)}</strong>`;
  hint.style.display = cfg.showHint ? '' : 'none';
  area.appendChild(hint);

  // Bekreft-knapp
  const confirmBtn = document.createElement('button');
  confirmBtn.className   = 'btn-confirm';
  confirmBtn.textContent = 'Sjekk svar ✓';
  area.appendChild(confirmBtn);

  drawClock(svg, h, selM);

  bindInteractive(svg, newM => {
    if (gs.answered) return;
    selM = newM;
    drawClock(svg, h, selM);
    if (cfg.showHint) hint.innerHTML = `Du viser nå: <strong>${getLabel(h, selM)}</strong>`;
  });

  confirmBtn.addEventListener('click', () => {
    if (gs.answered) return;
    gs.answered       = true;
    confirmBtn.disabled = true;
    const ok = selM === m;
    if (!ok) drawClock(svg, h, m);
    registerAnswer(ok, correct);
  });
}

// ── Logg (localStorage) ───────────────────────────────────────
const LOG_KEY = 'klokketrening_log';
const MAX_LOG = 30;

function getLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }
  catch { return []; }
}

function saveToLog(entry) {
  const log = getLog();
  log.unshift(entry);
  if (log.length > MAX_LOG) log.splice(MAX_LOG);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

function settingsKey(s) {
  if (s.marks !== undefined) return `${s.mode}|${s.exprStyle}|m${s.marks}|n${s.showNums ? 1 : 0}`;
  return `${s.mode}|${s.exprStyle}|${s.face || 'blank'}`; // bakoverkompatibel
}

// 12 tydelig forskjellige farger
const BADGE_PALETTE = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad',
  '#d35400', '#16a085', '#2c3e50', '#f39c12',
  '#1abc9c', '#e74c3c', '#2ecc71', '#9b59b6',
];
const COLOR_MAP_KEY = 'klokke_colormap';

function getBadgeColor(key) {
  let map;
  try { map = JSON.parse(localStorage.getItem(COLOR_MAP_KEY) || '{}'); } catch { map = {}; }
  if (map[key] === undefined) {
    map[key] = Object.keys(map).length % BADGE_PALETTE.length;
    try { localStorage.setItem(COLOR_MAP_KEY, JSON.stringify(map)); } catch {}
  }
  return BADGE_PALETTE[map[key]];
}

function modeIcon(s) {
  return { 'show-clock': '🕐', 'show-expression': '✏️', 'both': '🔀' }[s.mode] || '⏱';
}

function settingsLabel(s) {
  const m = { 'show-clock': 'Gjett', 'show-expression': 'Still', 'both': 'Begge' }[s.mode] || s.mode;
  const e = s.exprStyle === 'digital' ? 'Digital' : 'Norsk';
  let f;
  if (s.marks !== undefined) {
    const mk = { 0: 'ingen', 4: '4 pkt', 12: '12 pkt' }[s.marks] || s.marks;
    f = s.showNums ? `${mk}+tall` : mk;
  } else {
    f = { blank: 'blank', markers: '4+tall', full: '12+tall' }[s.face] || s.face;
  }
  return `${m} · ${e} · ${f}`;
}

function getProgression(entry, log) {
  const key     = settingsKey(entry.settings);
  const sameKey = log.filter(e => settingsKey(e.settings) === key);
  const idx     = sameKey.indexOf(entry);
  const prev    = sameKey[idx + 1] || null;
  const best    = sameKey.reduce((b, e) =>
    e.score > b.score || (e.score === b.score && (e.avgTime || 999) < (b.avgTime || 999)) ? e : b
  , sameKey[0]);
  return { prev, best, isBest: entry === best };
}

const LOG_PAGE = 5;

function renderLog(limit = LOG_PAGE) {
  const logList = document.getElementById('log-list');
  if (!logList) return;
  const log = getLog();

  if (log.length === 0) {
    logList.innerHTML = '<p class="log-empty">Ingen øvelser ennå – start din første runde!</p>';
    return;
  }

  logList.innerHTML = '';
  const visible = log.slice(0, limit);
  visible.forEach((entry, idx) => {
    const key      = settingsKey(entry.settings);
    const color    = getBadgeColor(key);
    const icon     = modeIcon(entry.settings);
    const { prev, best, isBest } = getProgression(entry, log);

    const date    = new Date(entry.date);
    const dateStr = date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    const avgTxt  = entry.avgTime != null
      ? ' · ⏱ ' + entry.avgTime.toFixed(1).replace('.', ',') + ' sek'
      : '';

    // Progresjon vs forrige
    let prevHtml = '';
    if (prev) {
      const diff = entry.score - prev.score;
      const cls  = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
      const sign = diff > 0 ? '+' : '';
      prevHtml = `<span class="prog ${cls}">${sign}${diff} vs forrige</span>`;
    }

    // Beste
    const bestHtml = isBest
      ? `<span class="prog-best is-best">🏆 Beste!</span>`
      : `<span class="prog-best">Beste: ${best.score}/${best.total}</span>`;

    const el = document.createElement('div');
    el.className = 'log-entry';
    el.innerHTML = `
      <div class="log-badge" style="background:${color}">${icon}</div>
      <div class="log-info">
        <div class="log-meta">${dateStr} · ${timeStr} · <span class="log-settings-label">${settingsLabel(entry.settings)}</span></div>
        <div class="log-score">${entry.score} / ${entry.total}${avgTxt}</div>
        <div class="log-progress">${prevHtml}${bestHtml}</div>
      </div>
      <button class="log-repeat-btn">Gjenta</button>`;

    el.querySelector('.log-repeat-btn').addEventListener('click', () => applyLogEntry(entry));
    logList.appendChild(el);
  });

  if (log.length > limit) {
    const more = document.createElement('button');
    more.className = 'log-more-btn';
    more.textContent = `Vis flere (${log.length - limit} gjenstår)`;
    more.addEventListener('click', () => renderLog(limit + LOG_PAGE));
    logList.appendChild(more);
  }
}

function applyLogEntry(entry) {
  cfg.mode      = entry.settings.mode;
  cfg.exprStyle = entry.settings.exprStyle;
  if (entry.settings.marks !== undefined) {
    cfg.marks    = entry.settings.marks;
    cfg.showNums = entry.settings.showNums;
  } else {
    // Bakoverkompatibel med gammel face-verdi
    const map = { blank: [0, false], markers: [4, true], full: [12, true] };
    const [m, n] = map[entry.settings.face] || [0, false];
    cfg.marks = m; cfg.showNums = n;
  }
  updateSettingsUI();
  // Åpne Klokkevisning-kortet om det er lukket
  const card = document.getElementById('clock-settings-card');
  if (card && card.classList.contains('collapsed')) {
    card.classList.remove('collapsed');
    card.querySelector('.card-toggle').setAttribute('aria-expanded', 'true');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateSettingsUI() {
  document.querySelectorAll('.mode-card').forEach(c =>
    c.classList.toggle('active', c.dataset.mode === cfg.mode));
  document.querySelectorAll('input[name="style"]').forEach(r => { r.checked = r.value === cfg.exprStyle; });
  buildFaceOptions();
}

// ── Resultat ──────────────────────────────────────────────────
function showResult() {
  clearInterval(timerInt);

  // Gjennomsnitt per oppgave
  const avg = gs.taskTimes.length
    ? gs.taskTimes.reduce((a, b) => a + b, 0) / gs.taskTimes.length
    : null;
  const avgStr = avg != null ? avg.toFixed(1).replace('.', ',') + ' s' : '–';

  document.getElementById('final-score').textContent   = gs.score;
  document.getElementById('final-total').textContent   = TOTAL_Q;
  document.getElementById('final-streak').textContent  = gs.bestStreak;
  document.getElementById('final-avg-time').textContent = avgStr;

  const pct = gs.score / TOTAL_Q;
  document.getElementById('result-message').textContent =
    pct === 1   ? 'Perfekt! Du kan klokka! 🏆' :
    pct >= 0.8  ? 'Veldig bra jobbet! 👏'       :
    pct >= 0.6  ? 'Bra! Øv litt mer 💪'         :
                  'Ikke gi opp! Prøv igjen! 🌟';

  // Lagre økt
  const sessionSettings = { mode: cfg.mode, exprStyle: cfg.exprStyle, marks: cfg.marks, showNums: cfg.showNums };
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    settings: sessionSettings,
    score: gs.score,
    total: TOTAL_Q,
    taskTimes: gs.taskTimes,
    avgTime: avg != null ? parseFloat(avg.toFixed(2)) : null,
  };
  saveToLog(entry);
  renderLog();

  // Progresjonsmelding på resultatskjermen
  const log  = getLog();
  const key  = settingsKey(sessionSettings);
  const same = log.filter(e => settingsKey(e.settings) === key);
  // same[0] er akkurat det vi nettopp lagret; same[1] er forrige med samme innst.
  const prev = same[1] || null;
  const best = same.reduce((b, e) =>
    e.score > b.score || (e.score === b.score && (e.avgTime || 999) < (b.avgTime || 999)) ? e : b
  , same[0]);

  let progressMsg = '';
  if (prev) {
    const diff = gs.score - prev.score;
    if (diff > 0)      progressMsg = `↑ ${diff} poeng bedre enn forrige gang`;
    else if (diff < 0) progressMsg = `↓ ${Math.abs(diff)} poeng under forrige gang`;
    else               progressMsg = `Samme resultat som forrige gang`;
    if (same[0] === best) progressMsg += ' · 🏆 Ny rekord!';
  }
  document.getElementById('result-progress').textContent = progressMsg;

  showScreen('result-screen');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Sammenleggbar Klokkevisning
  document.querySelectorAll('.card-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const card     = btn.closest('.card');
      const expanded = !card.classList.contains('collapsed');
      card.classList.toggle('collapsed', expanded);
      btn.setAttribute('aria-expanded', String(!expanded));
    });
  });

  // Vis logg ved oppstart
  renderLog();

  // Modus-kort
  document.querySelectorAll('.mode-card').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      cfg.mode = c.dataset.mode;
    });
  });

  // Uttrykksstil
  document.querySelectorAll('input[name="style"]').forEach(r => {
    r.addEventListener('change', () => { cfg.exprStyle = r.value; });
  });

  // Klokkeansikt – visuell velger
  buildFaceOptions();

  // Hint
  document.getElementById('show-hint').addEventListener('change', e => {
    cfg.showHint = e.target.checked;
  });

  // Farger
  document.getElementById('hour-color').addEventListener('input',   e => { cfg.hourColor   = e.target.value; });
  document.getElementById('minute-color').addEventListener('input', e => { cfg.minuteColor = e.target.value; });

  // Start
  document.getElementById('start-btn').addEventListener('click', () => {
    resetGs();
    showScreen('game-screen');
    nextQ();
  });

  // Tilbake
  document.getElementById('back-btn').addEventListener('click', () => showScreen('settings-screen'));

  // Lyd av/på
  document.getElementById('sound-btn').addEventListener('click', () => {
    soundOn = !soundOn;
    document.getElementById('sound-btn').textContent = soundOn ? '🔊' : '🔇';
  });

  // Neste
  document.getElementById('next-btn').addEventListener('click', nextQ);

  // Resultatskjerm
  document.getElementById('play-again-btn').addEventListener('click', () => {
    resetGs();
    showScreen('game-screen');
    nextQ();
  });
  document.getElementById('settings-btn').addEventListener('click', () => showScreen('settings-screen'));
});
