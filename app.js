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
  Pull: ['One-arm Dumbbell Row', 'Bent-over Dumbbell Row', 'Dumbbell Shrugs', 'Dumbbell Bicep Curl', 'Hammer Curl'],
  Legs: ['Goblet Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Standing Calf Raises', 'Plank']
};

const quickWeights = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20];

const formGuides = Object.fromEntries(Object.values(split).flat().map(name => [name, {
  setup: 'Set stable base, brace core, align joints before each rep.',
  execution: 'Move with full control and complete range; pause briefly at peak contraction.',
  breathing: 'Inhale on lowering phase, exhale on effort phase.',
  mistakes: 'Avoid rushing reps, ego loading, and momentum swings.',
  targets: 'Primary movers + stabilizers based on this lift pattern.'
}]));
formGuides['One-arm Dumbbell Row'] = {
  setup: 'Split stance and support one hand on bench/thigh. Keep spine neutral.',
  execution: 'Drive elbow toward hip. LEFT ARM and RIGHT ARM are logged separately.',
  breathing: 'Inhale at extension, exhale as you row.',
  mistakes: 'Avoid torso rotation and shrugging shoulder up to ear.',
  targets: 'Lats, rhomboids, rear delts, biceps, core anti-rotation.'
};

const state = load() || {
  workouts: [], bodyweight: [], active: null, selectedDay: 'Push', view: 'home', xp: 0, level: 1, streak: 0,
  prHistory: {}, coachingIdx: 0, prToast: null
};

const coachingTips = ['Control the lowering phase', 'Keep core tight', 'Avoid swinging', 'Drive through full range', 'Own every rep'];
const app = document.getElementById('app');
const today = () => new Date().toISOString().slice(0, 10);
const fmt = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

let saveScheduled = false;
function save() {
  if (saveScheduled) return;
  saveScheduled = true;
  requestAnimationFrame(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveScheduled = false;
  });
}
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }

function workoutTypeForDate(d = new Date()) { return weeklySchedule[d.getDay()]; }

function getStats() {
  const t = workoutTypeForDate();
  return {
    total: state.workouts.length,
    todaysType: t,
    latestBw: state.bodyweight.at(-1)?.kg ?? '--',
    doneSets: state.active?.exercises.flatMap(e => e.sets).filter(s => s.done).length || 0,
    allSets: state.active?.exercises.flatMap(e => e.sets).length || 1
  };
}

function render() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  if (state.view === 'home') return renderHome();
  if (state.view === 'workout') return renderWorkout();
  if (state.view === 'history') return renderHistory();
  renderProgress();
}

function renderHome() {
  const s = getStats();
  app.innerHTML = `<section class="card glow"><div class="section-title"><h2>Today's Focus</h2><span class="pill">${s.todaysType} Day</span></div>
  <p class="small">Schedule: Mon/Thu Push · Tue/Fri Pull · Wed/Sat Legs · Sun Rest</p>
  <div class="progress"><span style="width:${Math.round((s.doneSets / s.allSets) * 100)}%"></span></div></section>
  <section class="grid-2">
   <article class="card"><p class="muted">Streak</p><p class="kpi">${state.streak} 🔥</p></article>
   <article class="card"><p class="muted">Total Workouts</p><p class="kpi">${s.total}</p></article>
   <article class="card"><p class="muted">Bodyweight</p><p class="kpi">${s.latestBw}</p></article>
   <article class="card"><p class="muted">Level</p><p class="kpi">${state.level}</p></article>
  </section>
  <section class="card"><div class="section-title"><h3>Quick Bodyweight Log</h3><button class="mini-btn" id="logBw">Save</button></div><input id="bwInput" type="number" placeholder="kg" step="0.1" /></section>
  <section class="card"><h3>Recovery Status</h3>${recoveryMarkup()}</section>`;
  document.getElementById('logBw').onclick = () => {
    const kg = Number(document.getElementById('bwInput').value); if (!kg) return;
    state.bodyweight.push({ date: today(), kg }); state.bodyweight = state.bodyweight.slice(-365); save(); render();
  };
}

function startWorkout(type) {
  if (type === 'Rest') return;
  state.active = {
    id: crypto.randomUUID(), type, date: today(), startedAt: Date.now(), notes: '', index: 0,
    exercises: split[type].flatMap(name => name === 'One-arm Dumbbell Row' ? [
      `${name} - LEFT ARM`, `${name} - RIGHT ARM`
    ] : [name]).map(name => ({ name, target: '8-12', sets: [1, 2, 3].map(n => ({ n, reps: '', weight: '', done: false })) }))
  };
  save();
}

function renderWorkout() {
  const has = !!state.active;
  const selected = workoutTypeForDate() === 'Rest' ? 'Push' : workoutTypeForDate();
  if (!state.active) state.selectedDay = selected;
  app.innerHTML = `<section class="card"><div class="section-title"><h2>Workout Split</h2><span class="small">${coachingTips[state.coachingIdx % coachingTips.length]}</span></div>
  <div class="workout-tabs">${Object.keys(split).map(d => `<button data-day="${d}" class="${state.selectedDay === d ? 'active' : ''}">${d}</button>`).join('')}</div>
  <div class="sticky-controls"><button id="startBtn" class="btn">${has ? 'Resume' : 'Start'} ${state.selectedDay}</button>${has ? '<button id="copyBtn" class="btn secondary">Copy Last Workout</button><button id="finishBtn" class="btn secondary">Finish</button>' : ''}</div></section>
  ${has ? activeWorkoutMarkup() : ''}`;

  app.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { state.selectedDay = b.dataset.day; save(); renderWorkout(); });
  document.getElementById('startBtn').onclick = () => { if (!state.active) startWorkout(state.selectedDay); renderWorkout(); };
  const finish = document.getElementById('finishBtn'); if (finish) finish.onclick = finishWorkout;
  const copyBtn = document.getElementById('copyBtn'); if (copyBtn) copyBtn.onclick = copyLastWorkout;
  bindWorkoutInputs();
}

function activeWorkoutMarkup() {
  const act = state.active;
  const elapsed = Math.floor((Date.now() - act.startedAt) / 1000);
  const total = act.exercises.flatMap(e => e.sets).length;
  const done = act.exercises.flatMap(e => e.sets).filter(s => s.done).length;
  const ex = act.exercises[act.index];
  const prBanner = state.prToast ? `<div class="pr-toast in-app">✨ NEW PR · +${state.prToast.bonus} XP · ${state.prToast.type.toUpperCase()}</div>` : '';
  return `<section class="card glow focus-mode"><div class="section-title"><h3>${act.type} Focus Mode</h3><span id="timerPill" class="pill">${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}</span></div>
  <div class="progress"><span style="width:${Math.round((done / total) * 100)}%"></span></div>
  <div class="focus-progress">Exercise ${act.index + 1} of ${act.exercises.length}</div>
  ${prBanner}
  <div class="exercise-nav"><button class="mini-btn" id="prevEx">◀</button><p>${act.index + 1}/${act.exercises.length}</p><button class="mini-btn" id="nextEx">▶</button></div>
  ${exerciseMarkup(ex, act.index)}
  <label>Notes<textarea id="workoutNotes" placeholder="felt stronger today..."></textarea></label></section>`;
}

function exerciseMarkup(e, ei) {
  const cues = ['control the lowering', 'don’t swing', 'brace core', 'full range of motion'];
  const cueMarkup = cues.map(c => `<span class="cue-chip">${c}</span>`).join('');
  return `<article class="exercise card open exercise-slide" data-ei="${ei}"><div class="exercise-header"><div><strong class="exercise-title">${e.name}</strong><div class="exercise-meta">Target ${e.target} · Prev ${previous(e.name)}</div></div></div>
  <div class="coach-banner">Technique: ${coachingTips[(state.coachingIdx + ei) % coachingTips.length]}</div>
  <div class="cue-row">${cueMarkup}</div>
  <div class="exercise-content">${e.sets.map((s, si) => setRow(ei, si, s)).join('')}</div>
  <details class="guide" open><summary>Exercise Form Guide</summary>
    <ul><li><b>Setup:</b> ${guideFor(e.name).setup}</li><li><b>Execution:</b> ${guideFor(e.name).execution}</li><li><b>Breathing:</b> ${guideFor(e.name).breathing}</li><li><b>Common mistakes:</b> ${guideFor(e.name).mistakes}</li><li><b>Target muscles:</b> ${guideFor(e.name).targets}</li></ul>
  </details></article>`;
}

function setRow(ei, si, s) {
  return `<div class="set-row card" data-ei="${ei}" data-si="${si}"><div class="set-meta"><span class="pill set-label">Set ${s.n}</span><button class="complete-toggle ${s.done ? 'done' : ''}">${s.done ? '✓ COMPLETE' : 'TAP TO COMPLETE'}</button></div>
  <div class="set-inputs"><label>Reps<div class="quick-wrap"><input type="number" min="0" inputmode="numeric" class="reps-input" value="${s.reps}" /><button class="mini-btn rep-plus">+1</button></div></label>
  <label>Weight (kg)<div class="quick-wrap"><input type="number" min="0" step="0.5" inputmode="decimal" class="weight-input" value="${s.weight}" /><button class="mini-btn weight-plus">+2.5</button></div></label></div>
  <div class="weight-chips">${quickWeights.map(w => `<button class="chip" data-w="${w}">${w}kg</button>`).join('')}</div></div>`;
}

function bindWorkoutInputs() {
  const notes = document.getElementById('workoutNotes'); if (notes) { notes.value = state.active.notes || ''; notes.oninput = e => { state.active.notes = e.target.value; save(); }; }
  document.getElementById('prevEx')?.addEventListener('click', () => { state.active.index = Math.max(0, state.active.index - 1); state.coachingIdx++; save(); renderWorkout(); });
  document.getElementById('nextEx')?.addEventListener('click', () => { state.active.index = Math.min(state.active.exercises.length - 1, state.active.index + 1); state.coachingIdx++; save(); renderWorkout(); });
  let touchX = null;
  app.querySelector('.focus-mode')?.addEventListener('touchstart', e => touchX = e.changedTouches[0].screenX, { passive: true });
  app.querySelector('.focus-mode')?.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - touchX;
    if (Math.abs(dx) > 60) { state.active.index = dx < 0 ? Math.min(state.active.index + 1, state.active.exercises.length - 1) : Math.max(state.active.index - 1, 0); save(); renderWorkout(); }
  }, { passive: true });

  app.querySelectorAll('.set-row').forEach(row => {
    const ei = Number(row.dataset.ei), si = Number(row.dataset.si), set = state.active.exercises[ei].sets[si], exName = state.active.exercises[ei].name;
    row.querySelector('.complete-toggle').onclick = () => {
      set.done = !set.done; state.xp += set.done ? 10 : -10; recalcLevel();
      if (set.done) detectPR(exName, set);
      save(); renderWorkout();
    };
    row.querySelector('.reps-input').oninput = e => { set.reps = e.target.value; save(); };
    row.querySelector('.weight-input').oninput = e => { set.weight = e.target.value; save(); };
    row.querySelector('.rep-plus').onclick = () => { set.reps = Number(set.reps || 0) + 1; save(); renderWorkout(); };
    row.querySelector('.weight-plus').onclick = () => { set.weight = (Number(set.weight || 0) + 2.5).toFixed(1); save(); renderWorkout(); };
    row.querySelectorAll('.chip').forEach(chip => chip.onclick = () => { set.weight = chip.dataset.w; save(); renderWorkout(); });
  });
}

function recalcLevel() { state.level = Math.max(1, Math.floor(state.xp / 100) + 1); }
function guideFor(name) { return formGuides[name.replace(' - LEFT ARM', '').replace(' - RIGHT ARM', '')] || formGuides['Dumbbell Floor Press']; }

function previous(name) {
  const vals = state.workouts.flatMap(w => w.exercises.filter(e => e.name === name)).flatMap(e => e.sets);
  if (!vals.length) return '—';
  const bestW = Math.max(...vals.map(s => Number(s.weight) || 0));
  const bestR = Math.max(...vals.map(s => Number(s.reps) || 0));
  return `${bestR} reps @ ${bestW}kg`;
}

function allTimeBest(name) {
  const fromHistory = state.workouts
    .flatMap(w => w.exercises.filter(e => e.name === name))
    .flatMap(e => e.sets);
  const fromActive = state.active ? state.active.exercises.filter(e => e.name === name).flatMap(e => e.sets) : [];
  const allSets = [...fromHistory, ...fromActive];
  return {
    reps: Math.max(0, ...allSets.map(s => Number(s.reps) || 0)),
    weight: Math.max(0, ...allSets.map(s => Number(s.weight) || 0))
  };
}

function detectPR(name, set) {
  const p = allTimeBest(name);
  const reps = Number(set.reps) || 0, weight = Number(set.weight) || 0;
  const repPR = reps > p.reps;
  const weightPR = weight > p.weight;
  if (repPR || weightPR) {
    state.prHistory[name] = { reps: Math.max(reps, p.reps), weight: Math.max(weight, p.weight) };
    const bonus = repPR && weightPR ? 60 : 35;
    state.xp += bonus;
    if (navigator.vibrate) navigator.vibrate([100, 60, 160]);
    state.prToast = { type: repPR && weightPR ? 'weight + reps' : repPR ? 'reps' : 'weight', bonus };
    setTimeout(() => { state.prToast = null; renderWorkout(); }, 1400);
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

function recoveryMarkup() {
  const muscle = { chest: 0, back: 0, shoulders: 0, legs: 0, arms: 0 };
  state.workouts.slice(-4).forEach((w, i) => {
    const fatigue = Math.max(15, 100 - i * 25);
    if (w.type === 'Push') { muscle.chest += fatigue; muscle.shoulders += fatigue; muscle.arms += fatigue / 2; }
    if (w.type === 'Pull') { muscle.back += fatigue; muscle.arms += fatigue; }
    if (w.type === 'Legs') { muscle.legs += fatigue; }
  });
  return Object.entries(muscle).map(([k, v]) => `<div class="recover-row"><span>${k}</span><div class="progress"><span style="width:${Math.min(v, 100)}%"></span></div></div>`).join('');
}

function finishWorkout() {
  if (!state.active) return;
  state.workouts.push({ ...state.active }); state.workouts = state.workouts.slice(-500);
  state.active = null; state.streak += 1; state.xp += 100; recalcLevel(); save(); render();
}

function renderHistory() {
  app.innerHTML = `<section class="card"><h2>Workout History</h2>${state.workouts.slice().reverse().map(w => `<article class="card"><div class="section-title"><strong>${fmt(w.date)} · ${w.type}</strong><span class="small">${w.exercises.length} exercises</span></div>
  ${w.exercises.map(e => `<p class="small">${e.name}: ${e.sets.map(s => `${s.reps || 0}x${s.weight || 0}`).join(', ')}</p>`).join('')}</article>`).join('') || '<p class="small">No sessions yet.</p>'}</section>`;
}

function renderProgress() {
  const exStats = {};
  state.workouts.forEach(w => w.exercises.forEach(e => {
    const top = Math.max(...e.sets.map(s => (Number(s.weight) || 0) * (Number(s.reps) || 0)));
    (exStats[e.name] ||= []).push(top);
  }));
  const bw = state.bodyweight.slice(-14);
  const avgVolume = Object.values(exStats).flat().reduce((a, b) => a + b, 0) / Math.max(1, Object.values(exStats).flat().length);
  const estMuscle = (avgVolume / 80 + state.workouts.length * 0.08).toFixed(1);
  app.innerHTML = `<section class="card"><h2>Progression Analytics</h2>
  <h3>Per-Exercise Strength Graph</h3>${Object.entries(exStats).slice(0, 8).map(([n, vals]) => `<div class="graph-row"><span>${n}</span><div class="spark">${vals.slice(-10).map(v => `<i style="height:${Math.max(6, Math.min(42, v / 6))}px"></i>`).join('')}</div></div>`).join('') || '<p class="small">No exercise data yet.</p>'}
  <h3>Bodyweight Graph</h3><div class="spark big">${bw.map(b => `<i style="height:${Math.max(8, b.kg)}px"></i>`).join('')}</div>
  <h3>Estimated Muscle Gain Progression</h3><p class="kpi">+${estMuscle}% trend</p><p class="small">Estimate based on workload trend and consistency.</p></section>`;
}

document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => { state.view = b.dataset.view; save(); render(); });
document.getElementById('themePulseBtn').onclick = () => document.body.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.2)' }, { filter: 'brightness(1)' }], { duration: 450 });
setInterval(() => {
  if (state.view !== 'workout' || !state.active) return;
  const pill = document.getElementById('timerPill');
  if (!pill) return;
  const elapsed = Math.floor((Date.now() - state.active.startedAt) / 1000);
  pill.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
}, 1000);
render();
