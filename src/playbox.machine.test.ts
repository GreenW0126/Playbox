import { createActor } from 'xstate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playboxMachine } from './playbox.machine';

function reachFirstBlock(now = 1_000_000) {
  const actor = createActor(playboxMachine).start();
  actor.send({ type: 'SELECT_ROLE', role: 'Researcher' });
  actor.send({ type: 'SUBMIT_TASK', task: 'Test task' });
  actor.send({ type: 'SELECT_DURATION', minutes: 30 });
  actor.send({ type: 'SPACE_READY', prepared: true });
  actor.send({ type: 'START', now });
  return actor;
}

describe('playboxMachine', () => {
  afterEach(() => vi.useRealTimers());

  it('starts the session with a five-minute mini block immediately', () => {
    const start = 500_000;
    const actor = createActor(playboxMachine).start();
    actor.send({ type: 'SELECT_ROLE', role: 'Researcher' });
    actor.send({ type: 'SUBMIT_TASK', task: 'Test task' });
    actor.send({ type: 'SELECT_DURATION', minutes: 30 });
    actor.send({ type: 'SPACE_READY', prepared: true });
    actor.send({ type: 'START', now: start });
    actor.send({ type: 'TICK', now: start + 5_000 });

    expect(actor.getSnapshot().matches({ focus: 'running' })).toBe(true);
    expect(actor.getSnapshot().context.totalRemaining).toBe(1795);
    expect(actor.getSnapshot().context.blockMinutes).toBe(5);
    expect(actor.getSnapshot().context.blockRemaining).toBe(295);
    actor.stop();
  });

  it('keeps the session clock running while choosing the next mini block', () => {
    const start = 750_000;
    const actor = reachFirstBlock(start);
    actor.send({ type: 'TICK', now: start + 5 * 60_000 });
    expect(actor.getSnapshot().matches({ focus: 'selectBlock' })).toBe(true);
    expect(actor.getSnapshot().context.totalRemaining).toBe(25 * 60);

    actor.send({ type: 'TICK', now: start + 5 * 60_000 + 8_000 });
    expect(actor.getSnapshot().context.totalRemaining).toBe(25 * 60 - 8);
    actor.stop();
  });

  it('rejects a mini block longer than the remaining session time', () => {
    const start = 850_000;
    const actor = reachFirstBlock(start);
    actor.send({ type: 'TICK', now: start + 27 * 60_000 });

    expect(actor.getSnapshot().matches({ focus: 'selectBlock' })).toBe(true);
    expect(actor.getSnapshot().context.totalRemaining).toBe(3 * 60);
    actor.send({ type: 'SELECT_BLOCK', minutes: 5, now: start + 27 * 60_000 });
    expect(actor.getSnapshot().matches({ focus: 'selectBlock' })).toBe(true);
    actor.stop();
  });

  it('freezes focus time while paused and records the interruption on resume', () => {
    const start = 1_000_000;
    const actor = reachFirstBlock(start);

    actor.send({ type: 'TICK', now: start + 5_000 });
    expect(actor.getSnapshot().context.totalRemaining).toBe(1795);

    actor.send({ type: 'PAUSE', now: start + 5_000 });
    const frozen = actor.getSnapshot().context.totalRemaining;
    actor.send({ type: 'RESUME', now: start + 65_000 });
    actor.send({ type: 'TICK', now: start + 66_000 });

    expect(actor.getSnapshot().context.totalRemaining).toBe(frozen - 1);
    expect(actor.getSnapshot().context.workflow.at(-1)?.kind).toBe('pause');
    actor.stop();
  });

  it('stores a local session record when the task is completed', () => {
    const start = 2_000_000;
    const actor = reachFirstBlock(start);
    actor.send({ type: 'OPEN_MENU', now: start + 60_000 });
    actor.send({ type: 'COMPLETE_BLOCK', now: start + 60_000 });
    actor.send({ type: 'TASK_COMPLETED', now: start + 60_000 });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('closed')).toBe(true);
    expect(snapshot.context.records).toHaveLength(1);
    expect(snapshot.context.records[0].task).toBe('Test task');
    expect(snapshot.context.records[0].workflow[0]).toMatchObject({ kind: 'block', minutes: 5 });
    actor.stop();
  });

  it('starts a fixed five-minute recovery period', () => {
    const start = 3_000_000;
    const actor = reachFirstBlock(start);
    actor.send({ type: 'OPEN_MENU', now: start + 1_000 });
    actor.send({ type: 'TASK_COMPLETED', now: start + 1_000 });
    actor.send({ type: 'CLOSE', now: start + 2_000 });

    expect(actor.getSnapshot().matches('recovery')).toBe(true);
    expect(actor.getSnapshot().context.recoveryRemaining).toBe(300);
    actor.send({ type: 'RESET_DEMO' });
    expect(actor.getSnapshot().matches('recovery')).toBe(true);

    actor.send({ type: 'TICK', now: start + 302_000 });
    expect(actor.getSnapshot().matches('recovery')).toBe(true);
    expect(actor.getSnapshot().context.recoveryRemaining).toBe(0);
    actor.send({ type: 'RESET_DEMO' });
    expect(actor.getSnapshot().matches('role')).toBe(true);
    actor.stop();
  });

  it('automatically enters recovery after showing the completed screen for thirty seconds', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const actor = reachFirstBlock(start);
    actor.send({ type: 'OPEN_MENU', now: start + 1_000 });
    actor.send({ type: 'TASK_COMPLETED', now: start + 1_000 });

    expect(actor.getSnapshot().matches('closed')).toBe(true);
    vi.advanceTimersByTime(29_999);
    expect(actor.getSnapshot().matches('closed')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(actor.getSnapshot().matches('recovery')).toBe(true);
    expect(actor.getSnapshot().context.recoveryRemaining).toBe(300);
    actor.stop();
  });

  it('never allocates mini blocks beyond the frame duration', () => {
    const start = 4_000_000;
    const actor = reachFirstBlock(start);
    actor.send({ type: 'OPEN_MENU', now: start + 1_000 });
    actor.send({ type: 'COMPLETE_BLOCK', now: start + 1_000 });

    actor.send({ type: 'SELECT_BLOCK', minutes: 30, now: start + 1_000 });
    expect(actor.getSnapshot().matches({ focus: 'selectBlock' })).toBe(true);

    actor.send({ type: 'SELECT_BLOCK', minutes: 15, now: start + 1_000 });
    expect(actor.getSnapshot().matches({ focus: 'running' })).toBe(true);
    expect(actor.getSnapshot().context.blockMinutes).toBe(15);
    actor.stop();
  });

  it('keeps role-specific recent tasks and moves submitted tasks to the top', () => {
    const actor = createActor(playboxMachine).start();
    actor.send({ type: 'SELECT_ROLE', role: 'Student' });

    expect(actor.getSnapshot().context.recentTasksByRole.Student).toEqual([
      'Essay', 'Language Learning', 'Reading', 'Exam Practice',
    ]);

    actor.send({ type: 'SUBMIT_TASK', task: '  Review chapter notes  ' });
    expect(actor.getSnapshot().context.recentTasksByRole.Student[0]).toBe('Review chapter notes');
    expect(actor.getSnapshot().context.recentTasksByRole.Researcher).toEqual([
      'Desk Research', 'Literature Review', 'Analysis', 'Writing',
    ]);
    expect(actor.getSnapshot().context.recentTasksByRole.Athlete).toEqual([
      'Relief', 'Strength', 'Wind Down', 'Recovery',
    ]);
    actor.stop();
  });

  it('stores the employee external sound environment choice for the session setup', () => {
    const actor = createActor(playboxMachine).start();
    actor.send({ type: 'SELECT_ROLE', role: 'Employee' });
    actor.send({ type: 'SUBMIT_TASK', task: 'Desk Work' });
    actor.send({ type: 'SELECT_DURATION', minutes: 15 });
    actor.send({ type: 'SET_SOUND_ENVIRONMENT', value: 'external' });

    expect(actor.getSnapshot().context.soundEnvironment).toBe('external');
    actor.send({ type: 'SPACE_READY', prepared: true });
    expect(actor.getSnapshot().matches('ready')).toBe(true);
    expect(actor.getSnapshot().context.soundEnvironment).toBe('external');
    actor.stop();
  });

  it('asks an athlete to name each mini block after its duration is set', () => {
    const start = 5_000_000;
    const actor = createActor(playboxMachine).start();
    actor.send({ type: 'SELECT_ROLE', role: 'Athlete' });
    actor.send({ type: 'SUBMIT_TASK', task: 'Strength' });
    actor.send({ type: 'SELECT_DURATION', minutes: 30 });
    actor.send({ type: 'SPACE_READY', prepared: true });
    actor.send({ type: 'START', now: start });

    expect(actor.getSnapshot().matches({ focus: 'selectBlockName' })).toBe(true);
    expect(actor.getSnapshot().context.blockMinutes).toBe(5);
    expect(actor.getSnapshot().context.blockDeadline).toBeNull();

    actor.send({ type: 'SELECT_BLOCK_NAME', name: 'Upper Body', now: start + 2_000 });
    expect(actor.getSnapshot().matches({ focus: 'running' })).toBe(true);
    expect(actor.getSnapshot().context.blockLabel).toBe('Upper Body');
    expect(actor.getSnapshot().context.blockDeadline).toBe(start + 302_000);
    actor.stop();
  });

  it('lets an athlete track only the full session without mini blocks', () => {
    const start = 6_000_000;
    const actor = createActor(playboxMachine).start();
    actor.send({ type: 'SELECT_ROLE', role: 'Athlete' });
    actor.send({ type: 'SUBMIT_TASK', task: 'Recovery' });
    actor.send({ type: 'SELECT_DURATION', minutes: 30 });
    actor.send({ type: 'SPACE_READY', prepared: true });
    actor.send({ type: 'START', now: start });
    actor.send({ type: 'SKIP_MINI_BLOCK' });

    expect(actor.getSnapshot().matches({ focus: 'runningWithoutBlock' })).toBe(true);
    expect(actor.getSnapshot().context.blockMinutes).toBe(0);
    expect(actor.getSnapshot().context.blockRemaining).toBe(0);
    actor.send({ type: 'TICK', now: start + 5_000 });
    expect(actor.getSnapshot().context.totalRemaining).toBe(1795);

    actor.send({ type: 'OPEN_MENU', now: start + 5_000 });
    actor.send({ type: 'TASK_COMPLETED', now: start + 5_000 });
    expect(actor.getSnapshot().context.records[0].workflow).toEqual([]);
    actor.stop();
  });

  it('restores durable notebook data independently from the active session', () => {
    const actor = createActor(playboxMachine).start();
    actor.send({
      type: 'RESTORE_USER_DATA',
      data: {
        records: [{
          id: 'saved-session', role: 'Employee', task: 'Prepare slides',
          allocatedMinutes: 30, activeSeconds: 1200, startedAt: 1, endedAt: 2,
          outcome: 'task_completed', spacePrepared: true, workflow: [],
        }],
        recentTasksByRole: {
          Student: ['Reading'],
          Researcher: ['Analysis'],
          Employee: ['Prepare slides', 'Meeting'],
          Athlete: ['Shoulder Mobility'],
        },
      },
    });

    expect(actor.getSnapshot().context.records[0].task).toBe('Prepare slides');
    expect(actor.getSnapshot().context.recentTasksByRole.Employee[0]).toBe('Prepare slides');
    actor.stop();
  });
});
