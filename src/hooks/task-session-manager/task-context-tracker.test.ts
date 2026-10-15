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
});
