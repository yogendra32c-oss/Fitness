const STORAGE_KEY = 'forge-os-v3';

const weeklySchedule = { 1: 'Push', 2: 'Pull', 3: 'Legs', 4: 'Push', 5: 'Pull', 6: 'Legs', 0: 'Rest' };

const split = {
  Push: ['Dumbbell Floor Press', 'Incline Pushups', 'Shoulder Press', 'Lateral Raise', 'Overhead Tricep Extension'],
  Pull: ['One-arm Dumbbell Row - LEFT ARM', 'One-arm Dumbbell Row - RIGHT ARM', 'Bent-over Dumbbell Row', 'Dumbbell Shrugs', 'Dumbbell Bicep Curl', 'Hammer Curl'],
  Legs: ['Goblet Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Standing Calf Raises', 'Plank']
};

const quickWeights = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20];
const app = document.getElementById('app');

const state = load() || {
  workouts: [], bodyweight: [], active: null, selectedDay: 'Push', view: 'home', xp: 0, level: 1, streak: 0,
  ui: { toast: null, celebrate: null, sparkleAt: 0 }
};

const today = () => new Date().toISOString().slice(0, 10);
const fmt = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const nowSec = () => Math.floor(Date.now() / 1000);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function recalcLevel() { state.level = Math.max(1, Math.floor(state.xp / 100) + 1); }
function workoutTypeForDate(d = new Date()) { return weeklySchedule[d.getDay()]; }

function startWorkout(type) {
  if (type === 'Rest') return;
  state.active = {
    id: crypto.randomUUID(), type, date: today(), startedAt: Date.now(), index: 0, setIndex: 0,
    exercises: split[type].map(name => ({
      name,
      target: '8-12',
      sets: [1, 2, 3].map(n => ({ n, reps: '', weight: '', done: false })),
      rec: recommendation(name)
    }))
  };
  save();
}

function render() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  if (state.view === 'home') return renderHome();
  if (state.view === 'workout') return renderWorkout();
  if (state.view === 'history') return renderHistory();
  renderProgress();
}

function renderHome() {
  const todaysType = workoutTypeForDate();
  const consistency = monthlyConsistency();
  app.innerHTML = `<section class="card"><div class="section-title"><h2>FORGE OS</h2><span class="pill">${todaysType} day</span></div>
  <p class="small">Immersive focus training with smart progression.</p></section>
  <section class="grid-2">
   <article class="card"><p class="muted">Streak</p><p class="kpi">${state.streak} 🔥</p></article>
   <article class="card"><p class="muted">Level</p><p class="kpi">${state.level}</p></article>
   <article class="card"><p class="muted">Workouts</p><p class="kpi">${state.workouts.length}</p></article>
   <article class="card"><p class="muted">Consistency</p><p class="kpi">${consistency}%</p></article>
  </section>
  <section class="card"><h3 class="small">Monthly heat</h3><div class="heatmap">${heatmapCells()}</div></section>`;
}

function renderWorkout() {
  const selected = workoutTypeForDate() === 'Rest' ? 'Push' : workoutTypeForDate();
  if (!state.active) state.selectedDay = selected;
  app.innerHTML = `<section class="card"><div class="section-title"><h2>Workout Split</h2><span class="small">Elite focus mode</span></div>
  <div class="workout-tabs">${Object.keys(split).map(d => `<button data-day="${d}" class="${state.selectedDay === d ? 'active' : ''}">${d}</button>`).join('')}</div>
  <div class="sticky-controls"><button id="startBtn" class="btn">${state.active ? 'Resume' : 'Start'} ${state.selectedDay}</button>${state.active ? '<button id="copyBtn" class="btn secondary">Copy Last Session</button><button id="finishBtn" class="btn secondary">Finish</button>' : ''}</div></section>
  ${state.active ? activeWorkoutMarkup() : skeleton('Start a workout to enter fullscreen focus flow.')}`;

  app.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { state.selectedDay = b.dataset.day; save(); renderWorkout(); });
  document.getElementById('startBtn').onclick = () => { if (!state.active) startWorkout(state.selectedDay); renderWorkout(); };
  document.getElementById('copyBtn')?.addEventListener('click', copyLastWorkout);
  document.getElementById('finishBtn')?.addEventListener('click', finishWorkout);
  if (state.active) bindFocus();
}

function activeWorkoutMarkup() {
  const act = state.active;
  const ex = act.exercises[act.index];
  const set = ex.sets[act.setIndex];
  const doneTotal = act.exercises.reduce((acc, e) => acc + e.sets.filter(s => s.done).length, 0);
  const totalSets = act.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const progress = Math.round((doneTotal / totalSets) * 100);
  const elapsed = Math.floor((Date.now() - act.startedAt) / 1000);
  const next = act.exercises[act.index + 1]?.name || 'Finish session';
  const pr = getExercisePR(ex.name);
  return `<section class="focus-screen" id="focusScreen">
    <div class="focus-progress"><span style="width:${progress}%"></span></div>
    <div class="focus-header"><p>${act.index + 1}/${act.exercises.length} · ${progress}%</p><p>${formatTimer(elapsed)} · 🔥${state.streak}</p></div>
    <h1 class="exercise-title">${ex.name}</h1>
    <p class="exercise-meta">Set ${act.setIndex + 1}/${ex.sets.length} · PR ${pr.weight}kg × ${pr.reps}</p>
    <div class="coach-banner">Last: ${previous(ex.name)} · Recommended: ${ex.rec.weight}kg × ${ex.rec.reps}</div>
    <div class="focus-set ${set.done ? 'done' : ''}">
      <button class="qty-btn" id="minusReps">−</button><div><p class="small">REPS</p><p class="qty-val" id="repsVal">${set.reps || 0}</p></div><button class="qty-btn" id="plusReps">＋</button>
    </div>
    <div class="focus-set ${set.done ? 'done' : ''}">
      <button class="qty-btn" id="minusWeight">−</button><div><p class="small">WEIGHT</p><p class="qty-val" id="weightVal">${set.weight || 0}<span class="unit">kg</span></p></div><button class="qty-btn" id="plusWeight">＋</button>
    </div>
    <div class="weight-chips">${quickWeights.map(w => `<button class="chip" data-w="${w}">${w}</button>`).join('')}</div>
    <button class="btn huge complete-set-btn" id="completeSetBtn">COMPLETE SET +10XP</button>
    <div class="next-preview"><p class="small">Next Exercise</p><strong>${next}</strong><span>⇠ Swipe</span><span>Swipe ⇢</span></div>
  </section>`;
}

function bindFocus() {
  const act = state.active; const ex = act.exercises[act.index]; const set = ex.sets[act.setIndex];
  const setNum = (k, delta) => { set[k] = Math.max(0, Number(set[k] || 0) + delta); save(); rafRenderWorkout(); };
  document.getElementById('minusReps').onclick = () => setNum('reps', -1);
  document.getElementById('plusReps').onclick = () => setNum('reps', 1);
  document.getElementById('minusWeight').onclick = () => setNum('weight', -2.5);
  document.getElementById('plusWeight').onclick = () => setNum('weight', 2.5);
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { set.weight = Number(c.dataset.w); save(); rafRenderWorkout(); });
  document.getElementById('completeSetBtn').onclick = () => completeSet();

  let sx = null;
  const focus = document.getElementById('focusScreen');
  focus.addEventListener('touchstart', e => { sx = e.changedTouches[0].screenX; }, { passive: true });
  focus.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].screenX - sx;
    if (Math.abs(dx) > 55) moveExercise(dx < 0 ? 1 : -1);
    sx = null;
  }, { passive: true });

  startTick();
}

let rafId = null;
function rafRenderWorkout() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => { rafId = null; renderWorkout(); });
}

let timerHandle = null;
function startTick() {
  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    const h = document.querySelector('.focus-header p:last-child');
    if (!h || !state.active) return;
    const elapsed = Math.floor((Date.now() - state.active.startedAt) / 1000);
    h.textContent = `${formatTimer(elapsed)} · 🔥${state.streak}`;
  }, 1000);
}

function completeSet() {
  const act = state.active; const ex = act.exercises[act.index]; const set = ex.sets[act.setIndex];
  if (set.done) return;
  set.done = true;
  state.xp += 10;
  detectPR(ex.name, set);
  microReward('+10 XP');
  recalcLevel();

  const nextSet = ex.sets.findIndex(s => !s.done);
  if (nextSet !== -1) act.setIndex = nextSet;
  else if (act.index < act.exercises.length - 1) { act.index += 1; act.setIndex = 0; }

  save();
  rafRenderWorkout();
}

function detectPR(name, set) {
  const history = state.workouts.flatMap(w => w.exercises.filter(e => e.name === name)).flatMap(e => e.sets);
  const reps = Number(set.reps) || 0; const weight = Number(set.weight) || 0;
  const est = Math.round(weight * (1 + reps / 30));
  const vol = reps * weight;
  const best = {
    weight: Math.max(0, ...history.map(s => Number(s.weight) || 0)),
    reps: Math.max(0, ...history.map(s => Number(s.reps) || 0)),
    est: Math.max(0, ...history.map(s => Math.round((Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30)))),
    vol: Math.max(0, ...history.map(s => (Number(s.weight) || 0) * (Number(s.reps) || 0)))
  };
  if (weight > best.weight || reps > best.reps || est > best.est || vol > best.vol) {
    state.xp += 45;
    if (navigator.vibrate) navigator.vibrate([35, 25, 75, 20, 120]);
    const banner = document.createElement('div');
    banner.className = 'pr-toast';
    banner.textContent = 'PR ACHIEVED +45 XP';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 1800);
  }
}

function microReward(text) {
  if (navigator.vibrate) navigator.vibrate(20);
  const fx = document.createElement('div');
  fx.className = 'xp-pop'; fx.textContent = text;
  document.body.appendChild(fx);
  setTimeout(() => fx.remove(), 700);
}

function recommendation(name) {
  const last = [...state.workouts].reverse().find(w => w.exercises.some(e => e.name === name));
  const prev = last?.exercises.find(e => e.name === name)?.sets?.at(-1);
  if (!prev) return { weight: 10, reps: 10 };
  const pW = Number(prev.weight) || 0; const pR = Number(prev.reps) || 0;
  const improved = pR >= 12;
  return { weight: Number((improved ? pW + 2.5 : pW).toFixed(1)), reps: improved ? 10 : Math.min(12, pR + 1) };
}

function getExercisePR(name) {
  const sets = state.workouts.flatMap(w => w.exercises.filter(e => e.name === name)).flatMap(e => e.sets);
  return { reps: Math.max(0, ...sets.map(s => Number(s.reps) || 0)), weight: Math.max(0, ...sets.map(s => Number(s.weight) || 0)) };
}

function moveExercise(delta) {
  if (!state.active) return;
  state.active.index = clamp(state.active.index + delta, 0, state.active.exercises.length - 1);
  state.active.setIndex = state.active.exercises[state.active.index].sets.findIndex(s => !s.done);
  if (state.active.setIndex === -1) state.active.setIndex = state.active.exercises[state.active.index].sets.length - 1;
  save();
  rafRenderWorkout();
}

function previous(name) {
  const vals = state.workouts.flatMap(w => w.exercises.filter(e => e.name === name)).flatMap(e => e.sets);
  if (!vals.length) return '—';
  const bestW = Math.max(...vals.map(s => Number(s.weight) || 0));
  const bestR = Math.max(...vals.map(s => Number(s.reps) || 0));
  return `${bestW}kg × ${bestR}`;
}

function copyLastWorkout() {
  const last = [...state.workouts].reverse().find(w => w.type === state.active.type);
  if (!last) return;
  state.active.exercises.forEach(ex => {
    const p = last.exercises.find(e => e.name === ex.name); if (!p) return;
    ex.sets.forEach((s, i) => { s.reps = p.sets[i]?.reps || ''; s.weight = p.sets[i]?.weight || ''; });
  });
  save(); renderWorkout();
}

function finishWorkout() {
  if (!state.active) return;
  state.workouts.push({ ...state.active, completedAt: Date.now() });
  state.workouts = state.workouts.slice(-500);
  state.active = null;
  state.streak += 1;
  state.xp += 100;
  recalcLevel();
  save();
  render();
}

function renderHistory() {
  app.innerHTML = `<section class="card"><h2>Workout History</h2>${state.workouts.slice().reverse().map(w => {
    const imbalance = unilateralImbalance(w);
    return `<article class="card"><strong>${fmt(w.date)} · ${w.type}</strong><p class="small">${imbalance || 'Balanced unilateral output'}</p></article>`;
  }).join('') || '<p class="small">No sessions yet.</p>'}</section>`;
}

function unilateralImbalance(w) {
  const l = w.exercises.find(e => e.name.includes('LEFT ARM'));
  const r = w.exercises.find(e => e.name.includes('RIGHT ARM'));
  if (!l || !r) return '';
  const lv = l.sets.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
  const rv = r.sets.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
  if (!lv || !rv) return '';
  const stronger = rv > lv ? 'Right' : 'Left';
  const diff = Math.round((Math.abs(rv - lv) / Math.min(rv, lv)) * 100);
  return diff > 8 ? `${stronger} side ${diff}% stronger` : 'Balanced unilateral output';
}

function renderProgress() {
  const exNames = [...new Set(state.workouts.flatMap(w => w.exercises.map(e => e.name)))].slice(0, 6);
  app.innerHTML = `<section class="card"><h2>Analytics</h2><p class="small">Per-exercise progression, strength estimate, volume, and workload.</p></section>
  ${exNames.map(name => `<section class="card"><h3>${name}</h3>${progressSpark(name)}${strengthSpark(name)}</section>`).join('') || skeleton('Complete workouts to unlock intelligence.')}`;
}

function progressSpark(exName) {
  const vals = state.workouts.flatMap(w => w.exercises.filter(e => e.name === exName)).map(e => e.sets.reduce((a, s) => a + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0));
  if (!vals.length) return '<p class="small">No volume data yet.</p>';
  return `<div class="spark">${vals.slice(-18).map(v => `<i style="height:${Math.max(6, Math.min(58, v / 8))}px"></i>`).join('')}</div>`;
}
function strengthSpark(exName) {
  const vals = state.workouts.flatMap(w => w.exercises.filter(e => e.name === exName)).map(e => Math.max(...e.sets.map(s => (Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30))));
  if (!vals.length) return '';
  return `<div class="spark alt">${vals.slice(-18).map(v => `<i style="height:${Math.max(6, Math.min(58, v / 4))}px"></i>`).join('')}</div>`;
}

function heatmapCells() {
  const byDay = new Set(state.workouts.map(w => w.date));
  return [...Array(30)].map((_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return `<i class="h${byDay.has(d) ? ' on' : ''}"></i>`;
  }).join('');
}

function monthlyConsistency() {
  const month = new Date().toISOString().slice(0, 7);
  const done = new Set(state.workouts.map(w => w.date).filter(d => d.startsWith(month))).size;
  const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return Math.round((done / days) * 100);
}

function skeleton(text) { return `<section class="card skeleton"><div></div><div></div><p class="small">${text}</p></section>`; }
function formatTimer(sec) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; }

document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => { state.view = b.dataset.view; save(); render(); });
document.getElementById('themePulseBtn').onclick = () => document.body.animate([{ transform: 'translateZ(0)' }, { filter: 'brightness(1.12)' }, { filter: 'brightness(1)' }], { duration: 380 });
render();
