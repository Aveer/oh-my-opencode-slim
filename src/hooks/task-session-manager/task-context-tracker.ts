import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ContextFile } from '../../utils';
import { log } from '../../utils/logger';

interface PendingContextFile {
  path: string;
  lines: Set<number>;
  lastReadAt: number;
}

/** Files larger than this are dropped from context instead of read:
 * they are logs/binaries at that size, and reading them blocks the
 * event loop and spikes memory. */
const MAX_VALIDATED_FILE_BYTES = 1024 * 1024;
/** Stop validating once this many bytes have been read in one commit;
 * remaining entries pass through unvalidated (pre-fix behavior) rather
 * than blocking the session. */
const MAX_VALIDATION_BYTES_PER_COMMIT = 8 * 1024 * 1024;

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
 * (missing/unreadable, oversized, or on-disk lines below the claimed
 * count). Coarse count-only check: misses rewrites that keep the line
 * count. Sync so the board commit call sites stay trivial; bounded by
 * a per-file size cap and a per-commit byte budget so validation can
 * never stall the session on large reads.
 */
// shortcut: count-only check, upgrade to max-line when callers pass lineNumbers
export function filterStaleContextFiles(
  directory: string,
  files: ContextFile[],
): ContextFile[] {
  let budgetLeft = MAX_VALIDATION_BYTES_PER_COMMIT;
  let budgetExhausted = false;
  const kept: ContextFile[] = [];
  for (const file of files) {
    if (budgetExhausted) {
      kept.push(file);
      continue;
    }
    const resolved = path.isAbsolute(file.path)
      ? file.path
      : path.join(directory, file.path);
    try {
      const size = statSync(resolved).size;
      if (size > MAX_VALIDATED_FILE_BYTES) {
        log('[task-session-manager] dropped stale read context', {
          path: file.path,
          reason: 'oversized',
          size,
        });
        continue;
      }
      budgetLeft -= size;
      if (budgetLeft < 0) {
        budgetExhausted = true;
        log(
          '[task-session-manager] read-context validation budget exhausted; passing remaining entries unvalidated',
          { remaining: files.length - kept.length - 1 },
        );
        kept.push(file);
        continue;
      }
      const content = readFileSync(resolved, 'utf8');
      const onDiskLines = content === '' ? 0 : content.split('\n').length;
      if (onDiskLines < file.lineCount) {
        log('[task-session-manager] dropped stale read context', {
          path: file.path,
          reason: 'truncated',
          lineCount: file.lineCount,
          onDiskLines,
        });
        continue;
      }
    } catch {
      log('[task-session-manager] dropped stale read context', {
        path: file.path,
        reason: 'unreadable',
      });
      continue;
    }
    kept.push(file);
  }
  return kept;
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
