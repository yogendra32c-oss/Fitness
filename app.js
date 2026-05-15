const STORAGE_KEY = 'ppl-command-center-v2';

const weeklySchedule = {
  1: 'Push',
  2: 'Pull',
  3: 'Legs',
  4: 'Push',
  5: 'Pull',
  6: 'Legs',
  0: 'Rest'
};

const split = {
  Push: ['Dumbbell Floor Press', 'Incline Pushups', 'Shoulder Press', 'Lateral Raise', 'Overhead Tricep Extension'],
  Pull: ['One-arm Dumbbell Row - LEFT ARM', 'One-arm Dumbbell Row - RIGHT ARM', 'Bent-over Dumbbell Row', 'Dumbbell Shrugs', 'Dumbbell Bicep Curl', 'Hammer Curl'],
  Legs: ['Goblet Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Standing Calf Raises', 'Plank']
};

const quickWeights = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20];
const techniqueCues = ['Control the lowering', 'Don’t swing', 'Brace core', 'Full range of motion'];

const formGuides = Object.fromEntries(Object.values(split).flat().map(name => [name, {
  setup: 'Set stable base, brace core, align joints before each rep.',
  execution: 'Move with full control and complete range; pause briefly at peak contraction.',
  breathing: 'Inhale on lowering phase, exhale on effort phase.',
  mistakes: 'Avoid rushing reps, ego loading, and momentum swings.',
  targets: 'Primary movers + stabilizers based on this lift pattern.'
}]));

const state = load() || {
  workouts: [], bodyweight: [], active: null, selectedDay: 'Push', view: 'home', xp: 0, level: 1, streak: 0,
  prHistory: {}, coachingIdx: 0, prToast: null
};

const app = document.getElementById('app');
const today = () => new Date().toISOString().slice(0, 10);
const fmt = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function recalcLevel() { state.level = Math.max(1, Math.floor(state.xp / 100) + 1); }
function workoutTypeForDate(d = new Date()) { return weeklySchedule[d.getDay()]; }

function render() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  if (state.view === 'home') return renderHome();
  if (state.view === 'workout') return renderWorkout();
  if (state.view === 'history') return renderHistory();
  renderProgress();
}

function getStats() {
  const t = workoutTypeForDate();
  return {
    total: state.workouts.length,
    todaysType: t,
    latestBw: state.bodyweight.at(-1)?.kg ?? '--'
  };
}

function renderHome() {
  const s = getStats();
  app.innerHTML = `<section class="card glow"><div class="section-title"><h2>Today's Focus</h2><span class="pill">${s.todaysType} Day</span></div>
  <p class="small">Schedule: Mon/Thu Push · Tue/Fri Pull · Wed/Sat Legs · Sun Rest</p></section>
  <section class="grid-2">
   <article class="card"><p class="muted">Streak</p><p class="kpi">${state.streak} 🔥</p></article>
   <article class="card"><p class="muted">Total Workouts</p><p class="kpi">${s.total}</p></article>
   <article class="card"><p class="muted">Bodyweight</p><p class="kpi">${s.latestBw}</p></article>
   <article class="card"><p class="muted">Level</p><p class="kpi">${state.level}</p></article>
  </section>`;
}

function startWorkout(type) {
  if (type === 'Rest') return;
  state.active = {
    id: crypto.randomUUID(), type, date: today(), startedAt: Date.now(), notes: '', index: 0,
    exercises: split[type].map(name => ({ name, target: '8-12', sets: [1, 2, 3].map(n => ({ n, reps: '', weight: '', done: false })) }))
  };
  save();
}

function renderWorkout() {
  const has = !!state.active;
  const selected = workoutTypeForDate() === 'Rest' ? 'Push' : workoutTypeForDate();
  if (!state.active) state.selectedDay = selected;

  app.innerHTML = `<section class="card"><div class="section-title"><h2>Workout Split</h2><span class="small">${techniqueCues[state.coachingIdx % techniqueCues.length]}</span></div>
  <div class="workout-tabs">${Object.keys(split).map(d => `<button data-day="${d}" class="${state.selectedDay === d ? 'active' : ''}">${d}</button>`).join('')}</div>
  <div class="sticky-controls"><button id="startBtn" class="btn">${has ? 'Resume' : 'Start'} ${state.selectedDay}</button>${has ? '<button id="copyBtn" class="btn secondary">Copy Last Session</button><button id="finishBtn" class="btn secondary">Finish</button>' : ''}</div></section>
  ${has ? activeWorkoutMarkup() : ''}`;

  app.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { state.selectedDay = b.dataset.day; save(); renderWorkout(); });
  document.getElementById('startBtn').onclick = () => { if (!state.active) startWorkout(state.selectedDay); renderWorkout(); };
  const finish = document.getElementById('finishBtn'); if (finish) finish.onclick = finishWorkout;
  const copyBtn = document.getElementById('copyBtn'); if (copyBtn) copyBtn.onclick = copyLastWorkout;
  bindWorkoutInputs();
}

function activeWorkoutMarkup() {
  const act = state.active;
  const total = act.exercises.length;
  const ex = act.exercises[act.index];
  const setsDone = ex.sets.filter(s => s.done).length;
  const progress = Math.round(((act.index + setsDone / ex.sets.length) / total) * 100);
  return `<section class="focus-screen">
      <div class="focus-progress"><span style="width:${progress}%"></span></div>
      <div class="focus-header"><p>${act.index + 1} / ${total}</p><p>${act.type}</p></div>
      <h1 class="exercise-title">${ex.name}</h1>
      <p class="exercise-meta">Target ${ex.target} · Previous ${previous(ex.name)}</p>
      <div class="coach-banner">${techniqueCues[(state.coachingIdx + act.index) % techniqueCues.length]}</div>
      ${ex.sets.map((s, si) => setSlideRow(si, s)).join('')}
      <div class="slide-nav"><button class="mini-btn" id="prevEx">◀</button><button class="btn huge" id="completeEx">Complete Exercise</button><button class="mini-btn" id="nextEx">▶</button></div>
      <div class="chart-block"><h4>Progression</h4>${progressSpark(ex.name)}</div>
    </section>`;
}

function setSlideRow(si, s) {
  return `<div class="set-row giant" data-si="${si}"><div class="set-meta"><span class="pill set-label">Set ${s.n}</span><button class="complete-toggle ${s.done ? 'done' : ''}">${s.done ? '✓' : '○'}</button></div>
  <div class="set-inputs">
    <label>Reps<div class="quick-wrap"><input type="number" min="0" class="reps-input" value="${s.reps}" /><button class="mini-btn rep-plus">+1</button></div></label>
    <label>Weight (kg)<div class="quick-wrap"><input type="number" min="0" step="0.5" class="weight-input" value="${s.weight}" /><button class="mini-btn weight-plus">+2.5</button></div></label></div>
  <div class="weight-chips">${quickWeights.map(w => `<button class="chip" data-w="${w}">${w}kg</button>`).join('')}</div></div>`;
}

function bindWorkoutInputs() {
  document.getElementById('prevEx')?.addEventListener('click', () => moveExercise(-1));
  document.getElementById('nextEx')?.addEventListener('click', () => moveExercise(1));
  document.getElementById('completeEx')?.addEventListener('click', () => {
    const ex = state.active.exercises[state.active.index];
    ex.sets.forEach(s => {
      if (!s.done) {
        s.done = true;
        state.xp += 10;
        detectPR(ex.name, s);
      }
    });
    recalcLevel();
    save();
    moveExercise(1);
  });

  let touchX = null;
  const focus = app.querySelector('.focus-screen');
  focus?.addEventListener('touchstart', e => touchX = e.changedTouches[0].screenX, { passive: true });
  focus?.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - touchX;
    if (Math.abs(dx) > 60) moveExercise(dx < 0 ? 1 : -1);
  }, { passive: true });

  app.querySelectorAll('.set-row').forEach(row => {
    const si = Number(row.dataset.si);
    const set = state.active.exercises[state.active.index].sets[si];
    const exName = state.active.exercises[state.active.index].name;
    row.querySelector('.complete-toggle').onclick = () => {
      set.done = !set.done;
      state.xp += set.done ? 10 : -10;
      recalcLevel();
      if (set.done) detectPR(exName, set);
      save();
      renderWorkout();
    };
    row.querySelector('.reps-input').oninput = e => { set.reps = e.target.value; save(); };
    row.querySelector('.weight-input').oninput = e => { set.weight = e.target.value; save(); };
    row.querySelector('.rep-plus').onclick = () => { set.reps = Number(set.reps || 0) + 1; save(); renderWorkout(); };
    row.querySelector('.weight-plus').onclick = () => { set.weight = (Number(set.weight || 0) + 2.5).toFixed(1); save(); renderWorkout(); };
    row.querySelectorAll('.chip').forEach(chip => chip.onclick = () => { set.weight = chip.dataset.w; save(); renderWorkout(); });
  });
}

function moveExercise(delta) {
  state.active.index = Math.max(0, Math.min(state.active.exercises.length - 1, state.active.index + delta));
  state.coachingIdx++;
  save();
  renderWorkout();
}

function previous(name) {
  const vals = state.workouts.flatMap(w => w.exercises.filter(e => e.name === name)).flatMap(e => e.sets);
  if (!vals.length) return '—';
  const bestW = Math.max(...vals.map(s => Number(s.weight) || 0));
  const bestR = Math.max(...vals.map(s => Number(s.reps) || 0));
  return `${bestR} reps @ ${bestW}kg`;
}

function detectPR(name, set) {
  const history = state.workouts.flatMap(w => w.exercises.filter(e => e.name === name)).flatMap(e => e.sets);
  const prevBestWeight = Math.max(0, ...history.map(s => Number(s.weight) || 0));
  const prevBestReps = Math.max(0, ...history.map(s => Number(s.reps) || 0));
  const reps = Number(set.reps) || 0, weight = Number(set.weight) || 0;
  if (weight > prevBestWeight || reps > prevBestReps) {
    state.prHistory[name] = { reps: Math.max(reps, prevBestReps), weight: Math.max(weight, prevBestWeight) };
    state.xp += 40;
    if (navigator.vibrate) navigator.vibrate([120, 70, 180]);
    state.prToast = `✨ NEW PR · +40 XP`;
    const pr = document.createElement('div');
    pr.className = 'pr-toast';
    pr.textContent = state.prToast;
    document.body.appendChild(pr);
    setTimeout(() => pr.remove(), 1700);
  }
}

function copyLastWorkout() {
  const last = [...state.workouts].reverse().find(w => w.type === state.active.type);
  if (!last) return;
  state.active.exercises.forEach(ex => {
    const p = last.exercises.find(e => e.name === ex.name);
    if (!p) return;
    ex.sets.forEach((s, i) => { s.reps = p.sets[i]?.reps || ''; s.weight = p.sets[i]?.weight || ''; });
  });
  save(); renderWorkout();
}

function finishWorkout() {
  if (!state.active) return;
  state.workouts.push({ ...state.active }); state.workouts = state.workouts.slice(-500);
  state.active = null; state.streak += 1; state.xp += 100; recalcLevel(); save(); render();
}

function renderHistory() { app.innerHTML = `<section class="card"><h2>Workout History</h2>${state.workouts.slice().reverse().map(w => `<article class="card"><strong>${fmt(w.date)} · ${w.type}</strong></article>`).join('') || '<p class="small">No sessions yet.</p>'}</section>`; }
function progressSpark(exName) {
  const vals = state.workouts.flatMap(w => w.exercises.filter(e => e.name === exName)).map(e => Math.max(...e.sets.map(s => (Number(s.weight) || 0) * (Number(s.reps) || 0))));
  if (!vals.length) return '<p class="small">No data yet.</p>';
  return `<div class="spark">${vals.slice(-14).map(v => `<i style="height:${Math.max(6, Math.min(56, v / 6))}px"></i>`).join('')}</div>`;
}
function renderProgress() { app.innerHTML = '<section class="card"><h2>Progression</h2><p class="small">Open workout focus slides to view per-exercise charts.</p></section>'; }

document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => { state.view = b.dataset.view; save(); render(); });
document.getElementById('themePulseBtn').onclick = () => document.body.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.2)' }, { filter: 'brightness(1)' }], { duration: 450 });
render();
