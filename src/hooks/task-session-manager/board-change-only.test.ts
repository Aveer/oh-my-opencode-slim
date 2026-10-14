import { describe, expect, test } from 'bun:test';
import { BackgroundJobBoard } from '../../utils/background-job-fixture';
import {
  BACKGROUND_JOB_BOARD_METADATA_KEY,
  type InjectionState,
  injectBackgroundJobBoard,
  pruneReopenCorrectionState,
} from './board-injection';

const SESSION = 'ses_change_only';

type Message = {
  info: { role: string; id?: string };
  parts: Array<{
    type: string;
    text?: string;
    metadata?: Record<string, unknown>;
  }>;
};

function user(id: string) {
  return {
    info: { role: 'user', agent: 'orchestrator', sessionID: SESSION, id },
    parts: [{ type: 'text', text: `Continue ${id}` }],
  };
}

function stateFor(board: BackgroundJobBoard): InjectionState {
  return {
    backgroundJobBoard: board,
    terminalGate: {} as never,
    lifecycleLedger: {} as never,
    processedInjectedCompletions: new Set(),
    processedInjectedCompletionOrder: [],
    terminalJobsInjectedByParent: new Map(),
    pendingInjectedTerminalJobsByParent: new Map(),
    metadataKey: BACKGROUND_JOB_BOARD_METADATA_KEY,
    shouldManageSession: () => true,
    taskContextTracker: {
      pendingManagedTaskIds: new Set(),
      contextFilesForPrompt: () => [],
      prune: () => {},
    },
    lastInjectedBoardTextByParent: new Map(),
    retainedTailBoards: new Map(),
  } as unknown as InjectionState;
}

function setup() {
  const board = new BackgroundJobBoard();
  board.registerLaunch({
    taskID: 'child-1',
    parentSessionID: SESSION,
    agent: 'explorer',
    description: 'map hooks',
  });
  return { board, state: stateFor(board) };
}

async function inject(
  state: InjectionState,
  history: unknown[],
): Promise<Message[]> {
  // Host requests start from real history, not earlier injected parts.
  const output = { messages: structuredClone(history) };
  await injectBackgroundJobBoard(state, {}, output as never);
  return output.messages as Message[];
}

function boardParts(messages: Message[]) {
  return messages.flatMap((message) =>
    message.parts.filter(
      (part) => part.metadata?.[BACKGROUND_JOB_BOARD_METADATA_KEY] === true,
    ),
  );
}

describe('change-only board digest', () => {
  test('(a) identical consecutive turns: the board is injected once, the next turn adds nothing', async () => {
    const { state } = setup();
    const first = await inject(state, [user('u1')]);
    expect(boardParts(first)).toHaveLength(1);

    // Same board state, new real user turn. The frozen copy rides on u1;
    // the fresh tail gets no board part and no marker.
    const second = await inject(state, [user('u1'), user('u2')]);
    expect(boardParts(second)).toHaveLength(1);
    expect(second.at(-1)?.parts).toHaveLength(1);
    expect(second.at(-1)?.parts[0]?.metadata).toBeUndefined();
    expect(JSON.stringify(second[0])).toBe(JSON.stringify(first[0]));
  });

  test('(b) a state change between turns injects a new board on the changed turn', async () => {
    const { board, state } = setup();
    await inject(state, [user('u1')]);
    const history = [user('u1'), user('u2')];
    expect(boardParts(await inject(state, history))).toHaveLength(1);

    board.updateStatus({
      taskID: 'child-1',
      state: 'completed',
      resultSummary: 'mapped hooks',
    });
    const changed = await inject(state, [...history, user('u3')]);
    const tailPart = changed.at(-1)?.parts.at(-1);
    expect(tailPart?.metadata?.[BACKGROUND_JOB_BOARD_METADATA_KEY]).toBe(true);
    expect(tailPart?.text).toContain('Result: mapped hooks');
  });

  test('(c) pruning a parent clears its digest so a recreated session renders fresh', async () => {
    const { state } = setup();
    await inject(state, [user('u1')]);
    expect(state.lastInjectedBoardTextByParent?.has(SESSION)).toBe(true);

    pruneReopenCorrectionState(state, SESSION);
    expect(state.lastInjectedBoardTextByParent?.has(SESSION)).toBe(false);

    const recreated = await inject(state, [user('u1')]);
    expect(boardParts(recreated)).toHaveLength(1);
  });

  test('(d) an assistant-tail skip registers nothing: the stop stays pending for the recovery wake', async () => {
    // Greptile P1 (5dd58fb review): registration used to run BEFORE the
    // placement decision, so an assistant-tail turn (A5: nothing placed)
    // recorded the terminal jobs as consumed. The next shape change then
    // reconciled them without the stop ever being displayed, and the
    // queued stopped-job recovery wake failed its terminalUnreconciled
    // check — the parent could miss the stop entirely.
    const { board, state } = setup();
    await inject(state, [user('u1')]);

    const assistant = {
      info: { role: 'assistant', agent: 'orchestrator', sessionID: SESSION },
      parts: [{ type: 'text', text: 'working on it' }],
    };
    board.updateStatus({
      taskID: 'child-1',
      state: 'stopped',
      resultSummary: 'crashed',
    });
    const skipped = await inject(state, [user('u1'), assistant]);
    expect(boardParts(skipped)).toHaveLength(1); // frozen replay only

    // Nothing registered: the stop is still unreconciled and no entry
    // awaits shape-change consumption.
    expect(state.terminalJobsInjectedByParent?.has(SESSION)).toBe(false);
    expect(board.get('child-1')).toMatchObject({
      state: 'stopped',
      terminalUnreconciled: true,
    });

    // The deferred render lands on the next user tail — and only now is
    // the stop registered for prompt-shape consumption.
    const surfaced = await inject(state, [user('u1'), assistant, user('u2')]);
    const tailPart = surfaced.at(-1)?.parts.at(-1);
    expect(tailPart?.metadata?.[BACKGROUND_JOB_BOARD_METADATA_KEY]).toBe(true);
    expect(tailPart?.text).toContain('stopped');
    expect(state.terminalJobsInjectedByParent?.has(SESSION)).toBe(true);
    expect(board.get('child-1')).toMatchObject({
      state: 'stopped',
      terminalUnreconciled: true,
    });
  });
});
