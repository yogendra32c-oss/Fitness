const STORAGE_KEY = 'ppl-command-center-v1';
const split = {
  Push: ['Dumbbell Floor Press','Incline Pushups','Shoulder Press','Lateral Raise','Overhead Tricep Extension'],
  Pull: ['One-arm Dumbbell Row','Bent-over Dumbbell Row','Dumbbell Shrugs','Dumbbell Bicep Curl','Hammer Curl'],
  Legs: ['Goblet Squat','Romanian Deadlift','Bulgarian Split Squat','Standing Calf Raises','Plank']
};

const state = load() || {
  workouts: [],
  bodyweight: [],
  active: null,
  selectedDay: 'Push',
  view: 'home',
  xp: 0,
  level: 1,
  streak: 0
};

const app = document.getElementById('app');
const setTpl = document.getElementById('setRowTemplate');

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
const today = () => new Date().toISOString().slice(0,10);
const fmt = d => new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'});

function getStats(){
  const total = state.workouts.length;
  const todaysType = state.active?.type || (['Push','Pull','Legs'][new Date().getDay()%3]);
  const latestBw = state.bodyweight.at(-1)?.kg ?? '--';
  const doneSets = state.active?.exercises.flatMap(e=>e.sets).filter(s=>s.done).length || 0;
  const allSets = state.active?.exercises.flatMap(e=>e.sets).length || 1;
  return {total,todaysType,latestBw,doneSets,allSets};
}

function estimateProgress(type){
  const ws = state.workouts.filter(w=>w.type===type).slice(-5);
  let score = 0;
  ws.forEach(w=>w.exercises.forEach(e=>e.sets.forEach(s=>score += (Number(s.reps)||0)*(Number(s.weight)||0||1))));
  return Math.round(score/ws.length || 0);
}

function render(){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===state.view));
  if(state.view==='home') return renderHome();
  if(state.view==='workout') return renderWorkout();
  if(state.view==='history') return renderHistory();
  renderProgress();
}

function renderHome(){
  const s=getStats();
  app.innerHTML=`
  <section class="card glow"><div class="section-title"><h2>Today's Focus</h2><span class="pill">${s.todaysType} Day</span></div>
  <p class="small">Train hard. Log fast. Progress forever.</p>
  <div class="progress"><span style="width:${Math.round((s.doneSets/s.allSets)*100)}%"></span></div></section>
  <section class="grid-2">
   <article class="card"><p class="muted">Streak</p><p class="kpi">${state.streak} 🔥</p></article>
   <article class="card"><p class="muted">Total Workouts</p><p class="kpi">${s.total}</p></article>
   <article class="card"><p class="muted">Bodyweight</p><p class="kpi">${s.latestBw}</p></article>
   <article class="card"><p class="muted">Level</p><p class="kpi">${state.level}</p></article>
  </section>
  <section class="card">
    <div class="section-title"><h3>Quick Bodyweight Log</h3><button class="mini-btn" id="logBw">Save</button></div>
    <input id="bwInput" type="number" placeholder="kg" step="0.1" />
  </section>
  <section class="card"><h3>Achievements</h3><div class="badges"><div class="card badge">Consistency Pro</div><div class="card badge">Iron Focus</div><div class="card badge">Volume Beast</div></div></section>
  <section class="card"><h3>Weekly Completion</h3><div class="calendar">${Array.from({length:21},(_,i)=>`<div class="day ${Math.random()>.45?'done':''}"></div>`).join('')}</div></section>`;
  document.getElementById('logBw').onclick=()=>{
    const kg=Number(document.getElementById('bwInput').value);
    if(!kg) return;
    state.bodyweight.push({date:today(),kg}); save(); render();
  };
}

function startWorkout(type){
  state.active={id:crypto.randomUUID(), type, date:today(), startedAt:Date.now(), notes:'', exercises: split[type].map(name=>({name,target:'8-12',sets:[1,2,3].map(n=>({n,reps:'',weight:'',done:false}))}))};
  save();
}

function renderWorkout(){
  const has=!!state.active;
  app.innerHTML=`<section class="card"><div class="section-title"><h2>Workout Split</h2><span class="small">Recovery: ${recoveryStatus()}</span></div>
  <div class="workout-tabs">${Object.keys(split).map(d=>`<button data-day="${d}" class="${state.selectedDay===d?'active':''}">${d}</button>`).join('')}</div>
  <div class="sticky-controls"><button id="startBtn" class="btn">${has?'Resume':'Start'} ${state.selectedDay}</button>${has?'<button id="finishBtn" class="btn secondary">Finish</button>':''}</div></section>
  ${has?activeWorkoutMarkup():''}`;

  app.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{state.selectedDay=b.dataset.day;save();renderWorkout();});
  document.getElementById('startBtn').onclick=()=>{if(!state.active) startWorkout(state.selectedDay); renderWorkout();};
  const finish=document.getElementById('finishBtn'); if(finish) finish.onclick=finishWorkout;
  bindWorkoutInputs();
}

function activeWorkoutMarkup(){
  const act=state.active;
  const elapsed=Math.floor((Date.now()-act.startedAt)/1000);
  const mins=String(Math.floor(elapsed/60)).padStart(2,'0'); const secs=String(elapsed%60).padStart(2,'0');
  const total=act.exercises.flatMap(e=>e.sets).length;
  const done=act.exercises.flatMap(e=>e.sets).filter(s=>s.done).length;
  return `<section class="card glow"><div class="section-title"><h3>${act.type} Session</h3><span class="pill">${mins}:${secs}</span></div>
  <div class="progress"><span style="width:${Math.round((done/total)*100)}%"></span></div>
  <p class="small">${Math.round((done/total)*100)}% complete</p>
  ${act.exercises.map((e,ei)=>`<article class="exercise card" data-ei="${ei}">
  <div class="exercise-header"><div><strong>${e.name}</strong><div class="exercise-meta">Target ${e.target} · Prev ${previous(e.name)}</div></div><button class="mini-btn expander">Open</button></div>
  <div class="exercise-content">${e.sets.map((s,si)=>setRow(ei,si,s)).join('')}</div></article>`).join('')}
  <label>Notes<textarea id="workoutNotes" placeholder="felt stronger today..."></textarea></label>
  </section>`;
}
function setRow(ei,si,s){
  const n=setTpl.content.firstElementChild.cloneNode(true);
  n.dataset.ei=ei; n.dataset.si=si;
  n.querySelector('.set-label').textContent=`Set ${s.n}`;
  n.querySelector('.complete-toggle').classList.toggle('done',s.done);
  n.querySelector('.complete-toggle').textContent=s.done?'✓':'○';
  n.querySelector('.reps-input').value=s.reps;
  n.querySelector('.weight-input').value=s.weight;
  return n.outerHTML;
}

function bindWorkoutInputs(){
  const notes=document.getElementById('workoutNotes'); if(notes){notes.value=state.active.notes||''; notes.oninput=e=>{state.active.notes=e.target.value;save();};}
  app.querySelectorAll('.expander').forEach(b=>b.onclick=e=>{
    const ex=e.target.closest('.exercise'); ex.classList.toggle('open');
    b.textContent=ex.classList.contains('open')?'Hide':'Open';
  });
  app.querySelectorAll('.set-row').forEach(row=>{
    const ei=Number(row.dataset.ei), si=Number(row.dataset.si), set=state.active.exercises[ei].sets[si];
    row.querySelector('.complete-toggle').onclick=()=>{set.done=!set.done; state.xp += set.done?10:-10; recalcLevel(); save(); renderWorkout();};
    row.querySelector('.reps-input').oninput=e=>{set.reps=e.target.value;save();};
    row.querySelector('.weight-input').oninput=e=>{set.weight=e.target.value;save();};
    row.querySelector('.rep-plus').onclick=()=>{set.reps=Number(set.reps||0)+1;save();renderWorkout();};
    row.querySelector('.weight-plus').onclick=()=>{set.weight=(Number(set.weight||0)+2.5).toFixed(1);save();renderWorkout();};
  });
}

function recalcLevel(){ state.level=Math.max(1,Math.floor(state.xp/100)+1); }
function previous(name){
  const last=[...state.workouts].reverse().find(w=>w.exercises.some(e=>e.name===name));
  if(!last) return '—';
  const ex=last.exercises.find(e=>e.name===name);
  const bestW=Math.max(...ex.sets.map(s=>Number(s.weight)||0));
  const bestR=Math.max(...ex.sets.map(s=>Number(s.reps)||0));
  return `${bestR} reps @ ${bestW}kg`;
}
function recoveryStatus(){
  const last=state.workouts.at(-1); if(!last) return 'Ready';
  const h=(Date.now()-new Date(last.date).getTime())/36e5;
  return h<24?'Recovering':'Ready';
}

function finishWorkout(){
  if(!state.active) return;
  state.workouts.push({...state.active});
  state.active=null;
  const lastDate=state.workouts.at(-2)?.date;
  state.streak = lastDate===new Date(Date.now()-86400000).toISOString().slice(0,10) ? state.streak+1 : state.streak+1;
  state.xp += 100; recalcLevel(); save(); render();
  const popup=document.createElement('div');
  popup.className='celebration'; popup.innerHTML='<div class="card glow"><h2>Workout Complete 🎉</h2><p>XP gained. Consistency locked in.</p><button class="btn" id="closeCelebration">Continue</button></div>';
  document.body.appendChild(popup); document.getElementById('closeCelebration').onclick=()=>popup.remove();
}

function renderHistory(){
  app.innerHTML=`<section class="card"><h2>Workout History</h2>${state.workouts.slice().reverse().map(w=>`<article class="card"><div class="section-title"><strong>${fmt(w.date)} · ${w.type}</strong><span class="small">${w.exercises.length} exercises</span></div>
  ${w.exercises.map(e=>`<p class="small">${e.name}: ${e.sets.map(s=>`${s.reps||0}x${s.weight||0}`).join(', ')}</p>`).join('')}<p class="small">Notes: ${w.notes||'—'}</p></article>`).join('') || '<p class="small">No sessions yet.</p>'}</section>`;
}
function renderProgress(){
  const push=estimateProgress('Push'), pull=estimateProgress('Pull'), legs=estimateProgress('Legs');
  const bw=state.bodyweight.slice(-7);
  app.innerHTML=`<section class="card"><h2>Progression</h2>
  <div class="grid-2"><article class="card"><p class="muted">Push Power</p><p class="kpi">${push}</p></article><article class="card"><p class="muted">Pull Power</p><p class="kpi">${pull}</p></article><article class="card"><p class="muted">Leg Power</p><p class="kpi">${legs}</p></article><article class="card"><p class="muted">XP</p><p class="kpi">${state.xp}</p></article></div>
  <h3>Bodyweight (7)</h3>
  <div class="grid-2">${bw.map(x=>`<div class="card"><p>${x.kg}kg</p><p class="small">${fmt(x.date)}</p></div>`).join('') || '<p class="small">No bodyweight logs yet.</p>'}
  </div></section>`;
}

document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;save();render();});
document.getElementById('themePulseBtn').onclick=()=>document.body.animate([{filter:'brightness(1)'},{filter:'brightness(1.2)'},{filter:'brightness(1)'}],{duration:450});
setInterval(()=>{ if(state.view==='workout'&&state.active) renderWorkout(); }, 1000);
render();
