import { assign, setup } from 'xstate';

export type Role = 'Student' | 'Researcher' | 'Employee' | 'Athlete';
export const DEFAULT_RECENT_TASKS: Record<Role, string[]> = {
  Student: ['Essay', 'Language Learning', 'Reading', 'Exam Practice'],
  Researcher: ['Desk Research', 'Literature Review', 'Analysis', 'Writing'],
  Employee: ['Desk Work', 'Project Work', 'Meeting', 'Presentation'],
  Athlete: ['Relief', 'Strength', 'Wind Down', 'Recovery'],
};
const RECOVERY_SECONDS = 5 * 60;
export type WorkflowEntry =
  | { id: string; kind: 'block'; minutes: number; label?: string }
  | { id: string; kind: 'pause' };

export interface SessionRecord {
  id: string;
  role: Role;
  task: string;
  allocatedMinutes: number;
  activeSeconds: number;
  startedAt: number;
  endedAt: number;
  outcome: 'task_completed' | 'time_completed';
  spacePrepared: boolean;
  workflow: WorkflowEntry[];
}

export interface PersistedUserData {
  records: SessionRecord[];
  recentTasksByRole: Record<Role, string[]>;
}

export interface PlayboxContext {
  role: Role;
  task: string;
  durationMinutes: number;
  totalRemaining: number;
  blockMinutes: number;
  blockRemaining: number;
  blockLabel: string | null;
  workflow: WorkflowEntry[];
  recoveryRemaining: number;
  spacePrepared: boolean;
  soundEnvironment: 'off' | 'external';
  totalDeadline: number | null;
  blockDeadline: number | null;
  recoveryDeadline: number | null;
  sessionId: string | null;
  sessionStartedAt: number | null;
  records: SessionRecord[];
  recentTasksByRole: Record<Role, string[]>;
}

type Event =
  | { type: 'RESTORE_USER_DATA'; data: PersistedUserData }
  | { type: 'SELECT_ROLE'; role: Role }
  | { type: 'SUBMIT_TASK'; task: string }
  | { type: 'SELECT_DURATION'; minutes: number }
  | { type: 'SPACE_READY'; prepared: boolean }
  | { type: 'SET_SOUND_ENVIRONMENT'; value: 'off' | 'external' }
  | { type: 'START'; now?: number }
  | { type: 'SELECT_BLOCK'; minutes: number; now?: number }
  | { type: 'SELECT_BLOCK_NAME'; name: string; now?: number }
  | { type: 'SKIP_MINI_BLOCK' }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now?: number }
  | { type: 'RESUME'; now?: number }
  | { type: 'OPEN_MENU'; now?: number }
  | { type: 'RETURN'; now?: number }
  | { type: 'COMPLETE_BLOCK'; now?: number }
  | { type: 'TASK_COMPLETED'; now?: number }
  | { type: 'CLOSE'; now?: number }
  | { type: 'OPEN_HISTORY' }
  | { type: 'CLOSE_HISTORY' }
  | { type: 'RESET_DEMO' }
  | { type: 'BACK'; target: 'role' | 'task' | 'duration' | 'space' };

const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
const eventNow = (event: Event) => 'now' in event && event.now ? event.now : Date.now();
const secondsUntil = (deadline: number | null, fallback: number, now: number) =>
  deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : fallback;
const allocatedBlockMinutes = (workflow: WorkflowEntry[]) => workflow.reduce(
  (total, entry) => total + (entry.kind === 'block' ? entry.minutes : 0),
  0,
);

function createRecord(
  context: PlayboxContext,
  outcome: SessionRecord['outcome'],
  endedAt: number,
  totalRemaining: number,
  workflow = context.workflow,
): SessionRecord {
  return {
    id: context.sessionId ?? uid(),
    role: context.role,
    task: context.task,
    allocatedMinutes: context.durationMinutes,
    activeSeconds: Math.max(0, context.durationMinutes * 60 - totalRemaining),
    startedAt: context.sessionStartedAt ?? endedAt,
    endedAt,
    outcome,
    spacePrepared: context.spacePrepared,
    workflow,
  };
}

export const playboxMachine = setup({
  types: { context: {} as PlayboxContext, events: {} as Event },
  guards: {
    totalEnds: ({ context, event }) => event.type === 'TICK' && Boolean(context.totalDeadline && context.totalDeadline <= event.now),
    blockEnds: ({ context, event }) => event.type === 'TICK' && Boolean(context.blockDeadline && context.blockDeadline <= event.now),
    recoveryEnds: ({ context, event }) => event.type === 'TICK' && Boolean(context.recoveryDeadline && context.recoveryDeadline <= event.now),
    recoveryReady: ({ context }) => context.recoveryRemaining === 0,
    blockFitsFrame: ({ context, event }) => event.type === 'SELECT_BLOCK'
      && allocatedBlockMinutes(context.workflow) + event.minutes <= context.durationMinutes
      && event.minutes * 60 <= secondsUntil(context.totalDeadline, context.totalRemaining, eventNow(event)),
    athleteBlockFitsFrame: ({ context, event }) => context.role === 'Athlete' && event.type === 'SELECT_BLOCK'
      && allocatedBlockMinutes(context.workflow) + event.minutes <= context.durationMinutes
      && event.minutes * 60 <= secondsUntil(context.totalDeadline, context.totalRemaining, eventNow(event)),
    isAthlete: ({ context }) => context.role === 'Athlete',
  },
  actions: {
    restoreUserData: assign(({ event }) => event.type === 'RESTORE_USER_DATA' ? {
      records: event.data.records.slice(0, 100),
      recentTasksByRole: {
        ...DEFAULT_RECENT_TASKS,
        ...event.data.recentTasksByRole,
        Athlete: DEFAULT_RECENT_TASKS.Athlete,
      },
    } : {}),
    setRole: assign(({ event }) => event.type === 'SELECT_ROLE' ? { role: event.role, soundEnvironment: 'off' as const } : {}),
    setTask: assign(({ context, event }) => {
      if (event.type !== 'SUBMIT_TASK') return {};
      const task = event.task.trim();
      const roleTasks = context.recentTasksByRole?.[context.role] ?? DEFAULT_RECENT_TASKS[context.role];
      return {
        task,
        recentTasksByRole: context.role === 'Athlete' ? context.recentTasksByRole : {
          ...context.recentTasksByRole,
          [context.role]: [task, ...roleTasks.filter(item => item.toLocaleLowerCase() !== task.toLocaleLowerCase())].slice(0, 8),
        },
      };
    }),
    setDuration: assign(({ event }) => event.type === 'SELECT_DURATION' ? {
      durationMinutes: event.minutes,
      totalRemaining: event.minutes * 60,
    } : {}),
    setSpacePrepared: assign({
      spacePrepared: ({ event }) => event.type === 'SPACE_READY' ? event.prepared : false,
    }),
    setSoundEnvironment: assign(({ event }) => event.type === 'SET_SOUND_ENVIRONMENT'
      ? { soundEnvironment: event.value }
      : {}),
    beginSession: assign(({ context, event }) => {
      const now = eventNow(event);
      return {
        sessionId: uid(),
        sessionStartedAt: now,
        totalRemaining: context.durationMinutes * 60,
        blockMinutes: 5,
        blockRemaining: 5 * 60,
        blockLabel: null,
        totalDeadline: now + context.durationMinutes * 60_000,
        blockDeadline: context.role === 'Athlete' ? null : now + 5 * 60_000,
        workflow: [],
      };
    }),
    startBlock: assign(({ context, event }) => {
      if (event.type !== 'SELECT_BLOCK') return {};
      const now = eventNow(event);
      return {
        blockMinutes: event.minutes,
        blockRemaining: event.minutes * 60,
        blockLabel: null,
        totalDeadline: context.totalDeadline ?? now + context.totalRemaining * 1000,
        blockDeadline: now + event.minutes * 60_000,
      };
    }),
    prepareNamedBlock: assign(({ context, event }) => {
      if (event.type !== 'SELECT_BLOCK') return {};
      return {
        blockMinutes: event.minutes,
        blockRemaining: event.minutes * 60,
        blockLabel: null,
        blockDeadline: null,
        totalDeadline: context.totalDeadline,
      };
    }),
    startNamedBlock: assign(({ context, event }) => {
      if (event.type !== 'SELECT_BLOCK_NAME') return {};
      const now = eventNow(event);
      return {
        blockLabel: event.name,
        blockDeadline: now + context.blockRemaining * 1000,
        totalDeadline: context.totalDeadline ?? now + context.totalRemaining * 1000,
      };
    }),
    disableMiniBlocks: assign({
      blockMinutes: 0,
      blockRemaining: 0,
      blockLabel: null,
      blockDeadline: null,
    }),
    syncClock: assign(({ context, event }) => event.type === 'TICK' ? {
      totalRemaining: secondsUntil(context.totalDeadline, context.totalRemaining, event.now),
      blockRemaining: secondsUntil(context.blockDeadline, context.blockRemaining, event.now),
    } : {}),
    freezeClock: assign(({ context, event }) => {
      const now = eventNow(event);
      return {
        totalRemaining: secondsUntil(context.totalDeadline, context.totalRemaining, now),
        blockRemaining: secondsUntil(context.blockDeadline, context.blockRemaining, now),
        totalDeadline: null,
        blockDeadline: null,
      };
    }),
    resumeClock: assign(({ context, event }) => {
      const now = eventNow(event);
      return {
        totalDeadline: now + context.totalRemaining * 1000,
        blockDeadline: now + context.blockRemaining * 1000,
      };
    }),
    resumeSessionClock: assign(({ context, event }) => {
      const now = eventNow(event);
      return { totalDeadline: now + context.totalRemaining * 1000, blockDeadline: null };
    }),
    finishBlock: assign(({ context, event }) => {
      const now = eventNow(event);
      return {
        workflow: [...context.workflow, { id: uid(), kind: 'block' as const, minutes: context.blockMinutes, label: context.blockLabel ?? undefined }],
        blockRemaining: 0,
        blockDeadline: null,
        totalDeadline: now + context.totalRemaining * 1000,
      };
    }),
    finishBlockOnTick: assign(({ context, event }) => event.type === 'TICK' ? {
      totalRemaining: secondsUntil(context.totalDeadline, context.totalRemaining, event.now),
      blockRemaining: 0,
      totalDeadline: context.totalDeadline,
      blockDeadline: null,
      workflow: [...context.workflow, { id: uid(), kind: 'block' as const, minutes: context.blockMinutes, label: context.blockLabel ?? undefined }],
    } : {}),
    markPause: assign(({ context }) => ({
      workflow: [...context.workflow, { id: uid(), kind: 'pause' as const }],
    })),
    finalizeTask: assign(({ context, event }) => {
      const now = eventNow(event);
      const totalRemaining = secondsUntil(context.totalDeadline, context.totalRemaining, now);
      const record = createRecord(context, 'task_completed', now, totalRemaining);
      return {
        totalRemaining,
        totalDeadline: null,
        blockDeadline: null,
        records: [record, ...context.records.filter(item => item.id !== record.id)].slice(0, 100),
      };
    }),
    finalizeTime: assign(({ context, event }) => {
      if (event.type !== 'TICK') return {};
      const workflow = context.blockMinutes > 0 && context.blockRemaining > 0
        ? [...context.workflow, { id: uid(), kind: 'block' as const, minutes: Math.min(context.blockMinutes, Math.max(1, Math.ceil(context.blockMinutes - context.blockRemaining / 60))), label: context.blockLabel ?? undefined }]
        : context.workflow;
      const record = createRecord(context, 'time_completed', event.now, 0, workflow);
      return {
        totalRemaining: 0,
        blockRemaining: 0,
        totalDeadline: null,
        blockDeadline: null,
        workflow,
        records: [record, ...context.records.filter(item => item.id !== record.id)].slice(0, 100),
      };
    }),
    beginRecovery: assign(({ event }) => {
      const now = eventNow(event);
      return { recoveryRemaining: RECOVERY_SECONDS, recoveryDeadline: now + RECOVERY_SECONDS * 1000 };
    }),
    syncRecovery: assign(({ context, event }) => event.type === 'TICK' ? {
      recoveryRemaining: secondsUntil(context.recoveryDeadline, context.recoveryRemaining, event.now),
    } : {}),
    completeRecovery: assign({ recoveryRemaining: 0, recoveryDeadline: null }),
    resetSession: assign(({ context }) => ({
      totalRemaining: context.durationMinutes * 60,
      blockMinutes: 0,
      blockRemaining: 0,
      blockLabel: null,
      workflow: [],
      recoveryRemaining: RECOVERY_SECONDS,
      soundEnvironment: 'off',
      totalDeadline: null,
      blockDeadline: null,
      recoveryDeadline: null,
      sessionId: null,
      sessionStartedAt: null,
    })),
  },
}).createMachine({
  id: 'playbox',
  initial: 'role',
  context: {
    role: 'Researcher', task: '', durationMinutes: 60,
    totalRemaining: 60 * 60, blockMinutes: 0, blockRemaining: 0, blockLabel: null, workflow: [],
    recoveryRemaining: RECOVERY_SECONDS, spacePrepared: false, soundEnvironment: 'off', totalDeadline: null,
    blockDeadline: null, recoveryDeadline: null, sessionId: null,
    sessionStartedAt: null, records: [], recentTasksByRole: DEFAULT_RECENT_TASKS,
  },
  on: { RESTORE_USER_DATA: { actions: 'restoreUserData' } },
  states: {
    role: { on: { SELECT_ROLE: { target: 'task', actions: 'setRole' }, OPEN_HISTORY: 'history' } },
    history: { on: { CLOSE_HISTORY: 'role' } },
    task: { on: { SUBMIT_TASK: { target: 'duration', actions: 'setTask' }, BACK: { target: 'role' } } },
    duration: { on: { SELECT_DURATION: { target: 'space', actions: 'setDuration' }, BACK: { target: 'task' } } },
    space: { on: { SET_SOUND_ENVIRONMENT: { actions: 'setSoundEnvironment' }, SPACE_READY: { target: 'ready', actions: 'setSpacePrepared' }, BACK: { target: 'duration' } } },
    ready: { on: { START: [
      { target: 'focus.selectBlockName', guard: 'isAthlete', actions: 'beginSession' },
      { target: 'focus.running', actions: 'beginSession' },
    ], BACK: { target: 'space' } } },
    focus: {
      initial: 'selectBlock',
      states: {
        selectBlock: { on: {
          TICK: [
            { target: '#playbox.closed', guard: 'totalEnds', actions: 'finalizeTime' },
            { actions: 'syncClock' },
          ],
          SELECT_BLOCK: [
            { target: 'selectBlockName', guard: 'athleteBlockFitsFrame', actions: 'prepareNamedBlock' },
            { target: 'running', guard: 'blockFitsFrame', actions: 'startBlock' },
          ],
          PAUSE: { target: 'pausedSelecting', actions: 'freezeClock' },
          TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' },
        } },
        selectBlockName: { on: {
          TICK: [
            { target: '#playbox.closed', guard: 'totalEnds', actions: 'finalizeTime' },
            { actions: 'syncClock' },
          ],
          SELECT_BLOCK_NAME: { target: 'running', actions: 'startNamedBlock' },
          SKIP_MINI_BLOCK: { target: 'runningWithoutBlock', actions: 'disableMiniBlocks' },
          PAUSE: { target: 'pausedNaming', actions: 'freezeClock' },
          TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' },
        } },
        runningWithoutBlock: { on: {
          TICK: [
            { target: '#playbox.closed', guard: 'totalEnds', actions: 'finalizeTime' },
            { actions: 'syncClock' },
          ],
          PAUSE: { target: 'pausedWithoutBlock', actions: 'freezeClock' },
          OPEN_MENU: { target: 'menuWithoutBlock', actions: 'freezeClock' },
        } },
        running: {
          on: {
            TICK: [
              { target: '#playbox.closed', guard: 'totalEnds', actions: 'finalizeTime' },
              { target: 'selectBlock', guard: 'blockEnds', actions: 'finishBlockOnTick' },
              { actions: 'syncClock' },
            ],
            PAUSE: { target: 'paused', actions: 'freezeClock' },
            OPEN_MENU: { target: 'menu', actions: 'freezeClock' },
          },
        },
        paused: { on: { RESUME: { target: 'running', actions: ['markPause', 'resumeClock'] }, TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' } } },
        pausedSelecting: { on: { RESUME: { target: 'selectBlock', actions: ['markPause', 'resumeSessionClock'] }, TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' } } },
        pausedNaming: { on: { RESUME: { target: 'selectBlockName', actions: ['markPause', 'resumeSessionClock'] }, TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' } } },
        pausedWithoutBlock: { on: { RESUME: { target: 'runningWithoutBlock', actions: ['markPause', 'resumeSessionClock'] }, TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' } } },
        menu: { on: { RETURN: { target: 'running', actions: 'resumeClock' }, COMPLETE_BLOCK: { target: 'selectBlock', actions: 'finishBlock' }, TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' } } },
        menuWithoutBlock: { on: { RETURN: { target: 'runningWithoutBlock', actions: 'resumeSessionClock' }, TASK_COMPLETED: { target: '#playbox.closed', actions: 'finalizeTask' } } },
      },
    },
    closed: {
      after: { 30_000: { target: 'recovery', actions: 'beginRecovery' } },
      on: { CLOSE: { target: 'recovery', actions: 'beginRecovery' } },
    },
    recovery: {
      on: {
        TICK: [
          { guard: 'recoveryEnds', actions: 'completeRecovery' },
          { actions: 'syncRecovery' },
        ],
        RESET_DEMO: { target: 'role', guard: 'recoveryReady', actions: 'resetSession' },
      },
    },
    readyAgain: { on: { RESET_DEMO: { target: 'role', actions: 'resetSession' } } },
  },
});
