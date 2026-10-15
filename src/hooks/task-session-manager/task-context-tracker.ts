import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ContextFile } from '../../utils';
import { log } from '../../utils/logger';

interface PendingContextFile {
  path: string;
  lines: Set<number>;
  lastReadAt: number;
}

export function createTaskContextTracker() {
  const contextByTask = new Map<string, Map<string, PendingContextFile>>();
  const pendingManagedTaskIds = new Set<string>();

  return {
    pendingManagedTaskIds,

    addContext(taskId: string, files: ContextFile[]) {
      if (files.length === 0) return;
      let context = contextByTask.get(taskId);
      if (!context) {
        context = new Map();
        contextByTask.set(taskId, context);
      }
      for (const file of files) {
        const pending = context.get(file.path) ?? {
          path: file.path,
          lines: new Set<number>(),
          lastReadAt: file.lastReadAt,
        };
        for (const line of file.lineNumbers ?? []) {
          pending.lines.add(line);
        }
        pending.lastReadAt = Math.max(pending.lastReadAt, file.lastReadAt);
        context.set(file.path, pending);
      }
    },

    prune(backgroundJobBoard: { taskIDs(): Set<string> }) {
      const remembered = backgroundJobBoard.taskIDs();
      for (const taskId of contextByTask.keys()) {
        if (!pendingManagedTaskIds.has(taskId) && !remembered.has(taskId)) {
          contextByTask.delete(taskId);
        }
      }
    },

    clearSession(sessionId: string) {
      contextByTask.delete(sessionId);
      pendingManagedTaskIds.delete(sessionId);
    },

    contextFilesForPrompt(taskId: string): ContextFile[] {
      const context = contextByTask.get(taskId);
      if (!context) return [];
      return [...context.values()].map((file) => ({
        path: file.path,
        lineCount: file.lines.size,
        lastReadAt: file.lastReadAt,
      }));
    },
  };
}

/**
 * Drop read-context entries that no longer match the file on disk
 * (missing/unreadable, or truncated since the read). Sync so the
 * board commit call sites stay trivial.
 */
export function filterStaleContextFiles(
  directory: string,
  files: ContextFile[],
): ContextFile[] {
  return files.filter((file) => {
    const resolved = path.isAbsolute(file.path)
      ? file.path
      : path.join(directory, file.path);
    let content: string;
    try {
      content = readFileSync(resolved, 'utf8');
    } catch {
      log('[task-session-manager] dropped stale read context', {
        path: file.path,
        reason: 'unreadable',
      });
      return false;
    }
    const onDiskLines = content === '' ? 0 : content.split('\n').length;
    const maxLine =
      file.lineNumbers && file.lineNumbers.length > 0
        ? Math.max(...file.lineNumbers)
        : file.lineCount;
    if (onDiskLines < file.lineCount || maxLine > onDiskLines) {
      log('[task-session-manager] dropped stale read context', {
        path: file.path,
        reason: 'truncated',
        lineCount: file.lineCount,
        onDiskLines,
      });
      return false;
    }
    return true;
  });
}

export function extractReadFiles(
  root: string,
  output: { output: unknown; metadata?: unknown },
): ContextFile[] {
  if (typeof output.output !== 'string') return [];

  const extractPath = /<path>([^<]+)<\/path>/.exec(output.output)?.[1];
  if (!extractPath) return [];

  const relative = path.relative(root, extractPath);
  const normalized =
    !relative || relative.startsWith('..') || path.isAbsolute(relative)
      ? extractPath
      : relative;

  const matchedLines = new Set<number>();
  for (const match of output.output.matchAll(/^([0-9]+):/gm)) {
    matchedLines.add(Number(match[1]));
  }
  const lineNumbers = [...matchedLines];

  return [
    {
      path: normalized,
      lineCount: lineNumbers.length,
      lineNumbers,
      lastReadAt: Date.now(),
    },
  ];
}
