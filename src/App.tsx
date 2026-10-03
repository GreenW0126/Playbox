import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useMachine } from '@xstate/react';
import {
  ArrowLeft, ArrowRight, BookMarked, BookOpen, BriefcaseBusiness, Check, CircleMinus, Clock3,
  Dumbbell, Ellipsis, FlaskConical, Headphones, Hourglass, Laptop, Pause, Play, RotateCcw,
} from 'lucide-react';
import { DEFAULT_RECENT_TASKS, playboxMachine, type Role, type SessionRecord } from './playbox.machine';
import {
  loadPersistedLanguage, loadPersistedSnapshot, loadPersistedUserData,
  savePersistedLanguage, savePersistedSnapshot,
} from './persistence';
import { APP_NAME, IS_PUBLIC_DEMO } from './app-config';
import { localizeNode, translateText, type Language } from './i18n';

const LanguageContext = createContext<Language>('en');

const roles: Array<{ name: Role; note: string; Icon: typeof BookOpen }> = [
  { name: 'Student', note: 'Learn and practise', Icon: BookOpen },
  { name: 'Researcher', note: 'Read, examine, connect', Icon: FlaskConical },
  { name: 'Employee', note: 'Make and deliver', Icon: BriefcaseBusiness },
  { name: 'Athlete', note: 'Train and recover', Icon: Dumbbell },
];

const ATHLETE_BLOCK_NAMES: Record<string, string[]> = {
  Strength: ['Upper Body', 'Lower Body', 'Full Body'],
  Relief: ['Neck & Shoulders', 'Back', 'Wrists', 'Full Body'],
  'Wind Down': ['Gentle Stretch', 'Breathwork', 'Bedtime Mobility'],
  Recovery: ['Active Recovery', 'Joint Mobility', 'Full Body Reset'],
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

type SessionGroup = {
  key: string;
  task: string;
  role: Role;
  records: SessionRecord[];
};

const groupSessionRecords = (records: SessionRecord[]): SessionGroup[] => {
  const groups = new Map<string, SessionGroup>();
  records.forEach(record => {
    const key = `${record.role}:${record.task.trim().toLocaleLowerCase()}`;
    const group = groups.get(key);
    if (group) group.records.push(record);
    else groups.set(key, { key, task: record.task, role: record.role, records: [record] });
  });
  return [...groups.values()]
    .map(group => ({ ...group, records: group.records.sort((a, b) => b.endedAt - a.endedAt) }))
    .sort((a, b) => b.records[0].endedAt - a.records[0].endedAt);
};

function Back({ onClick }: { onClick: () => void }) {
  const language = useContext(LanguageContext);
  return <button className="back" onClick={onClick} aria-label={translateText('Back', language)}><ArrowLeft /></button>;
}

function Continue({ children = 'Continue', onClick, disabled = false }: { children?: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  const language = useContext(LanguageContext);
  return <button className="primary" onClick={onClick} disabled={disabled}>{localizeNode(children, language)}<ArrowRight /></button>;
}

function SetupPage({ step, title, subtitle, children }: { step: string; title: string; subtitle: string; children: React.ReactNode }) {
  const language = useContext(LanguageContext);
  const productStep = step === 'APP' ? APP_NAME.toUpperCase() : step;
  return <main className={`page setup-page${IS_PUBLIC_DEMO ? ' public-demo' : ''}`}>{!IS_PUBLIC_DEMO && <header className="outside-heading"><b>{productStep}</b><h1>{translateText(title, language)}</h1><p>{translateText(subtitle, language)}</p></header>}{localizeNode(children, language)}</main>;
}

function RecordWorkflow({ record }: { record: SessionRecord }) {
  const language = useContext(LanguageContext);
  if (record.workflow.length === 0) return <div className="record-workflow"><span className="record-empty">{translateText('No mini blocks recorded', language)}</span></div>;
  return <div className="record-workflow">{record.workflow.map(entry => entry.kind === 'pause'
    ? <span className="record-pause" key={entry.id}><i/>{translateText('Interrupted by reality', language)}<i/></span>
    : <span className="record-block" key={entry.id}><Check/>{entry.label && <b>{translateText(entry.label, language)}</b>}{translateText(`${entry.minutes} min`, language)}</span>)}</div>;
}

function Localized({ children }: { children: React.ReactNode }) {
  return localizeNode(children, useContext(LanguageContext));
}

function PlayboxApp() {
  const language = useContext(LanguageContext);
  const restoredSnapshot = useMemo(() => loadPersistedSnapshot(), []);
  const restoredUserData = useMemo(() => loadPersistedUserData(), []);
  const [snapshot, send, actorRef] = useMachine(playboxMachine, { snapshot: restoredSnapshot });
  const [task, setTask] = useState(snapshot.context.task);
  const [duration, setDuration] = useState(snapshot.context.durationMinutes);
  const [customDurationOpen, setCustomDurationOpen] = useState(![15, 30, 60, 90].includes(snapshot.context.durationMinutes));
  const [customDurationInput, setCustomDurationInput] = useState(
    ![15, 30, 60, 90].includes(snapshot.context.durationMinutes) ? String(snapshot.context.durationMinutes) : '',
  );
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<string | null>(null);
  const state = snapshot.value;
  const focusState = typeof state === 'object' && 'focus' in state ? state.focus : null;

  useEffect(() => {
    if (restoredUserData) send({ type: 'RESTORE_USER_DATA', data: restoredUserData });
  }, [restoredUserData, send]);

  useEffect(() => {
    const subscription = actorRef.subscribe(() => savePersistedSnapshot(actorRef.getPersistedSnapshot()));
    savePersistedSnapshot(actorRef.getPersistedSnapshot());
    return () => subscription.unsubscribe();
  }, [actorRef]);

  useEffect(() => {
    if (focusState !== 'running' && focusState !== 'runningWithoutBlock' && focusState !== 'selectBlock' && focusState !== 'selectBlockName' && state !== 'recovery') return;
    const sync = () => send({ type: 'TICK', now: Date.now() });
    sync();
    const id = window.setInterval(sync, 1000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [focusState, state, send]);

  const endTime = useMemo(() => {
    const d = new Date(Date.now() + duration * 60_000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [duration]);
  const customDurationValid = /^\d+$/.test(customDurationInput) && Number(customDurationInput) > 0;

  const recentTasks = snapshot.context.recentTasksByRole?.[snapshot.context.role]
    ?? DEFAULT_RECENT_TASKS[snapshot.context.role];
  const sessionGroups = useMemo(() => groupSessionRecords(snapshot.context.records), [snapshot.context.records]);
  const selectedSessionGroup = sessionGroups.find(group => group.key === selectedHistoryTask) ?? null;

  if (state === 'role') return <SetupPage step="APP" title="Who are you for this session?" subtitle="Choose which actions belong inside this frame."><section className="card role-card"><div className="role-list">{roles.map(({ name, note, Icon }) => <button key={name} className={name === snapshot.context.role ? 'role selected' : 'role'} onClick={() => { setTask(''); send({ type: 'SELECT_ROLE', role: name }); }}><Icon/><span><b>{name}</b><small>{note}</small></span><ArrowRight/></button>)}</div><button className="notebook-link" onClick={() => send({ type: 'OPEN_HISTORY' })}><BookMarked/> Session notebook <span>{snapshot.context.records.length}</span></button></section></SetupPage>;

  if (state === 'history') {
    const closeNotebook = () => { setSelectedHistoryTask(null); send({ type: 'CLOSE_HISTORY' }); };
    if (selectedSessionGroup) return <SetupPage step="APP" title="SESSION HISTORY" subtitle={`${selectedSessionGroup.task} · ${selectedSessionGroup.records.length} completed ${selectedSessionGroup.records.length === 1 ? 'session' : 'sessions'}.`}><section className="card history-card"><Back onClick={() => setSelectedHistoryTask(null)}/><div className="history-detail-heading"><span className="chip">{selectedSessionGroup.role}</span><h2>{selectedSessionGroup.task}</h2></div><div className="record-list record-list--detail">{selectedSessionGroup.records.map(record => <article className="record" key={record.id}><header><span>Session</span><time>{new Date(record.endedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</time></header><h2>{Math.ceil(record.activeSeconds / 60)} of {record.allocatedMinutes} min</h2><p>{record.outcome === 'task_completed' ? 'Task completed' : 'Frame completed'}</p><RecordWorkflow record={record}/></article>)}</div></section></SetupPage>;
    return <SetupPage step="APP" title="SESSION NOTEBOOK" subtitle="Repeated sessions gather under one task."><section className="card history-card"><Back onClick={closeNotebook}/>{sessionGroups.length === 0 ? <div className="empty-history"><BookMarked/><p>Your completed sessions will appear here.</p></div> : <div className="task-record-list">{sessionGroups.map(group => {
      if (group.records.length === 1) {
        const record = group.records[0];
        return <article className="record" key={record.id}><header><span className="chip">{record.role}</span><time>{new Date(record.endedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time></header><h2>{record.task}</h2><p>{Math.ceil(record.activeSeconds / 60)} of {record.allocatedMinutes} min</p><RecordWorkflow record={record}/></article>;
      }
      return <article className="task-record" key={group.key}><header><span className="chip">{group.role}</span><span>{group.records.length} sessions</span></header><h2>{group.task}</h2><div className="session-marks">{group.records.map(record => <button key={record.id} onClick={() => setSelectedHistoryTask(group.key)} aria-label={`Open ${group.task} session history`} title={new Date(record.endedAt).toLocaleDateString()}/>)}</div></article>;
    })}</div>}</section></SetupPage>;
  }

  if (state === 'task') return <SetupPage step="1." title="CHOOSE A TASK" subtitle="Start from what you actually want to work on."><section className="card form-card"><Back onClick={() => send({ type: 'BACK', target: 'role' })}/><span className="chip">{snapshot.context.role}</span><h2>What are you working on?</h2><input value={task} onChange={e => setTask(e.target.value)}/><label>Recent tasks</label><div className="recent">{recentTasks.map(item => <button key={item} onClick={() => setTask(item)}>{item}</button>)}</div><Continue disabled={!task.trim()} onClick={() => send({ type: 'SUBMIT_TASK', task })}/></section></SetupPage>;

  if (state === 'duration') return <SetupPage step="2." title="SET A DURATION" subtitle="Choose how long you want to stay with it."><section className="card form-card"><Back onClick={() => send({ type: 'BACK', target: 'task' })}/><h2>How long?</h2><div className="durations">{[15,30,60,90].map(m => <button className={!customDurationOpen && duration === m ? 'selected' : ''} key={m} onClick={() => { setCustomDurationOpen(false); setDuration(m); }}>{m} min</button>)}<button className={customDurationOpen ? 'selected' : ''} onClick={() => { setCustomDurationOpen(true); setCustomDurationInput(''); }}>Custom</button></div>{customDurationOpen && <div className="custom-duration"><input autoFocus type="number" inputMode="numeric" min="1" step="1" placeholder="Enter minutes" value={customDurationInput} onChange={event => { const value = event.target.value; setCustomDurationInput(value); if (/^\d+$/.test(value) && Number(value) > 0) setDuration(Number(value)); }}/><span>min</span></div>}{(!customDurationOpen || customDurationValid) && <div className="ends"><small>Ends at</small><b>{endTime}</b><span>(in {duration} min)</span></div>}<Continue disabled={customDurationOpen && !customDurationValid} onClick={() => send({ type: 'SELECT_DURATION', minutes: duration })}/></section></SetupPage>;

  if (state === 'space') return <SetupPage step="3." title="PREPARE YOUR SPACE" subtitle="Keep only what you need in view."><section className={`card form-card space-card${snapshot.context.role === 'Employee' ? ' employee-space' : ''}`}><Back onClick={() => send({ type: 'BACK', target: 'duration' })}/><h2>Clear your view for this task.</h2><p><strong>Anything inside the frame may ask for your attention.</strong><br/>Keep only what this task needs.</p><div className="scene-crop"><img src={snapshot.context.role === 'Athlete' ? './assets/prepare-space-athlete-v1.png' : './assets/prepare-space-v2.png'} alt={snapshot.context.role === 'Athlete' ? 'Yoga mat, dumbbells, resistance band and water bottle inside a visual reference frame' : 'Laptop, notebook, pen and desk lamp inside a visual reference frame'}/></div>{snapshot.context.role === 'Employee' && <div className="sound-environment"><strong>Sound environment</strong><div className="sound-options"><label><input type="radio" name="sound-environment" checked={snapshot.context.soundEnvironment === 'off'} onChange={() => send({ type: 'SET_SOUND_ENVIRONMENT', value: 'off' })}/><span>Off</span></label><label><input type="radio" name="sound-environment" checked={snapshot.context.soundEnvironment === 'external'} onChange={() => send({ type: 'SET_SOUND_ENVIRONMENT', value: 'external' })}/><span>On — I'll manage it outside Playbox</span></label></div></div>}<div className="space-actions"><button className="link" onClick={() => send({ type: 'SPACE_READY', prepared: false })}>Skip this step</button><Continue onClick={() => send({ type: 'SPACE_READY', prepared: true })}>Looks good</Continue></div></section></SetupPage>;

  if (state === 'ready') return <SetupPage step="4." title="READY TO START" subtitle="Confirm and enter your session."><section className="card ready-card"><Back onClick={() => send({ type: 'BACK', target: 'space' })}/><div className="ready-content"><span className="chip">{snapshot.context.role}</span><h2>{snapshot.context.task}</h2><p><Clock3/> {snapshot.context.durationMinutes} min</p>{snapshot.context.role === 'Employee' && snapshot.context.soundEnvironment === 'external' && <p><Headphones/> External playlist environment</p>}{snapshot.context.spacePrepared ? <p><Laptop/> Focused workspace ready</p> : <p className="muted"><CircleMinus/> Space check skipped</p>}</div><button className="primary solo" onClick={() => send({ type: 'START' })}>Start session</button></section></SetupPage>;

  if (typeof state === 'object' && 'focus' in state) {
    const choosingDuration = focusState === 'selectBlock' || focusState === 'pausedSelecting';
    const choosingName = focusState === 'selectBlockName' || focusState === 'pausedNaming';
    const choosing = choosingDuration || choosingName;
    const withoutBlock = focusState === 'runningWithoutBlock' || focusState === 'pausedWithoutBlock' || focusState === 'menuWithoutBlock';
    const paused = focusState === 'paused' || focusState === 'pausedSelecting' || focusState === 'pausedNaming' || focusState === 'pausedWithoutBlock';
    const menu = focusState === 'menu' || focusState === 'menuWithoutBlock';
    const withoutBlockMenu = focusState === 'menuWithoutBlock';
    const completedBlockMinutes = snapshot.context.workflow.reduce(
      (total, entry) => total + (entry.kind === 'block' ? entry.minutes : 0),
      0,
    );
    const currentBlockMinutes = choosingDuration ? 0 : snapshot.context.blockMinutes;
    const unallocatedMinutes = Math.max(
      0,
      snapshot.context.durationMinutes - completedBlockMinutes - currentBlockMinutes,
    );
    const blockChoices = [5, 10, 15, 30].filter(minutes =>
      minutes <= unallocatedMinutes && minutes * 60 <= snapshot.context.totalRemaining,
    );
    const athleteBlockNames = ATHLETE_BLOCK_NAMES[snapshot.context.task] ?? ['Mobility', 'Full Body', 'Recovery'];
    return <Localized><main className="page focus-page"><section className="focus-card"><div className="mist"><i/><i/><i/></div>
      {!choosing && !menu && (withoutBlock ? <div className="timer"><b>{formatTime(snapshot.context.totalRemaining)}</b><span>in this session</span></div> : <div className="timer"><b>{formatTime(snapshot.context.blockRemaining)}</b><span>Time remaining</span><small>{formatTime(snapshot.context.totalRemaining)} in this session</small></div>)}
      {(choosing || menu) && <div className={choosing ? 'choice-panel choice-panel--compact' : 'choice-panel'}>{choosing && <small className="selection-time">Time remaining&nbsp;&nbsp;{formatTime(snapshot.context.totalRemaining)}</small>}{choosingName ? <><div className="block-choices athlete-name-choices">{athleteBlockNames.map(name => <button key={name} disabled={paused} onClick={() => send({ type: 'SELECT_BLOCK_NAME', name })}>{name}</button>)}</div>{snapshot.context.workflow.length === 0 && <button className="wide-choice no-block-choice" onClick={() => send({ type: 'SKIP_MINI_BLOCK' })}>Go without mini-block</button>}<button className="wide-choice" onClick={() => send({ type: 'TASK_COMPLETED' })}>Task completed</button></> : choosingDuration ? <><div className="block-choices">{blockChoices.map(m => <button key={m} disabled={paused} onClick={() => send({ type: 'SELECT_BLOCK', minutes: m })}>{m} min</button>)}</div><button className="wide-choice" onClick={() => send({ type: 'TASK_COMPLETED' })}>Task completed</button></> : withoutBlockMenu ? <><h2>Current session</h2><button className="wide-choice" onClick={() => send({ type: 'TASK_COMPLETED' })}>Task completed</button><button className="plain" onClick={() => send({ type: 'RETURN' })}>Return</button></> : <><h2>Current mini block</h2><button className="wide-choice dark" onClick={() => send({ type: 'COMPLETE_BLOCK' })}><Check/> Complete mini block</button><button className="wide-choice" onClick={() => send({ type: 'TASK_COMPLETED' })}>Task completed</button><button className="plain" onClick={() => send({ type: 'RETURN' })}>Return</button></>}</div>}
      {!withoutBlock && <div className="workflow">{snapshot.context.workflow.map(entry => entry.kind === 'pause' ? <span className="pause-mark" key={entry.id} aria-label="Paused"><span className="pause-glyph"><i/><i/></span></span> : <span className="block done" key={entry.id} style={{flexGrow: entry.minutes}}>{entry.label && <small>{entry.label}</small>}{entry.minutes} min <Check/></span>)}{snapshot.context.blockMinutes > 0 && !choosing && <span className="block active" style={{flexGrow: Math.max(2, snapshot.context.blockMinutes)}}>{snapshot.context.blockLabel && <small>{snapshot.context.blockLabel}</small>}{snapshot.context.blockMinutes} min</span>}{unallocatedMinutes > 0 && <span className="block remaining" style={{flexGrow: Math.max(3, unallocatedMinutes)}}>{unallocatedMinutes} min remaining</span>}</div>}
      <footer><button className="round" onClick={() => send({ type: paused ? 'RESUME' : 'PAUSE' })}>{paused ? <Play/> : <Pause/>}</button><button className="round" onClick={() => paused ? send({ type: 'TASK_COMPLETED' }) : send({ type: 'OPEN_MENU' })}><Ellipsis/></button></footer>
    </section></main></Localized>;
  }

  if (state === 'closed') return <SetupPage step="5." title="SESSION COMPLETE" subtitle="A clear and satisfying closure."><section className="focus-card closed-card"><div className="mist"><i/><i/><i/></div><div className="closed-copy"><span><Check/></span><h2>Session complete.<br/>You are free.</h2><p>That's enough for now. Take a break. You've earned it.</p></div><button className="primary solo" onClick={() => send({ type: 'CLOSE' })}>Close</button></section></SetupPage>;

  if (state === 'recovery') return <SetupPage step="6." title="RECOVERY PERIOD" subtitle="No immediate restart."><section className="card recovery-card"><span className="hourglass"><Hourglass/></span><p>Next session won’t be available until 5 min.</p><div className="recovery-message"><strong>Now<br/>exhale.</strong><span>Focus is finite.<br/>Working is like breathing.</span></div><button className="recovery-return" disabled={snapshot.context.recoveryRemaining > 0} onClick={() => send({ type: 'RESET_DEMO' })}>Return to {APP_NAME} <ArrowRight/></button></section></SetupPage>;

  return <SetupPage step="APP" title="READY AGAIN" subtitle="Start a new session when you are ready."><section className="card ready-again"><h2>Ready when you are.</h2><button className="new-session" onClick={() => send({ type: 'RESET_DEMO' })}><RotateCcw/> Start a new session <ArrowRight/></button></section></SetupPage>;
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    if (!IS_PUBLIC_DEMO) return 'en';
    return loadPersistedLanguage() ?? (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
  });

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    if (IS_PUBLIC_DEMO) savePersistedLanguage(language);
  }, [language]);

  return <LanguageContext.Provider value={language}>
    {IS_PUBLIC_DEMO && <div className="language-setting" role="group" aria-label={translateText('Language', language)}>
      <button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')} lang="en">EN</button>
      <button className={language === 'zh' ? 'selected' : ''} onClick={() => setLanguage('zh')} lang="zh-CN">中文</button>
    </div>}
    <PlayboxApp />
  </LanguageContext.Provider>;
}
