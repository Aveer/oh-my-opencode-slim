import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { filterStaleContextFiles } from './task-context-tracker';

describe('filterStaleContextFiles', () => {
  test('keeps a file with enough lines on disk', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ctx-keep-'));
    writeFileSync(path.join(dir, 'a.ts'), '1\n2\n3\n4\n5');
    const kept = filterStaleContextFiles(dir, [
      { path: 'a.ts', lineCount: 3, lastReadAt: 1 },
    ]);
    expect(kept).toHaveLength(1);
  });

  test('drops a missing file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ctx-missing-'));
    const kept = filterStaleContextFiles(dir, [
      { path: 'gone.ts', lineCount: 2, lastReadAt: 1 },
    ]);
    expect(kept).toHaveLength(0);
  });

  test('drops a truncated file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ctx-trunc-'));
    writeFileSync(path.join(dir, 'b.ts'), '1\n2');
    const kept = filterStaleContextFiles(dir, [
      { path: 'b.ts', lineCount: 10, lastReadAt: 1 },
    ]);
    expect(kept).toHaveLength(0);
  });

  test('drops an oversized file without reading it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ctx-big-'));
    writeFileSync(path.join(dir, 'big.log'), `x\n`.repeat(600 * 1024));
    const kept = filterStaleContextFiles(dir, [
      { path: 'big.log', lineCount: 2, lastReadAt: 1 },
    ]);
    expect(kept).toHaveLength(0);
  });

  test('drops a stored entry that went stale after the first commit', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ctx-cont-'));
    writeFileSync(path.join(dir, 'live.ts'), '1\n2\n3\n4\n5');
    // Continuation scenario: stored board context re-validated alongside
    // fresh context; the deleted stored file must leave the result.
    const stored = [
      { path: 'deleted.ts', lineCount: 5, lastReadAt: 1 },
      { path: 'live.ts', lineCount: 5, lastReadAt: 2 },
    ];
    const fresh = [{ path: 'live.ts', lineCount: 5, lastReadAt: 3 }];
    const kept = filterStaleContextFiles(dir, [...stored, ...fresh]);
    expect(kept.some((file) => file.path === 'deleted.ts')).toBe(false);
    expect(kept.every((file) => file.path === 'live.ts')).toBe(true);
  });
});
