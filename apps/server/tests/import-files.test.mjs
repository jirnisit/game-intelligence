import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectImportFiles } from '../scripts/import-files.mjs';

test('collects a group recursively and still accepts one character directory or file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'import-files-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const group = join(root, 'characters', 'group B');
  const mei = join(group, 'mei');
  const nested = join(group, 'eliade', 'data');
  await mkdir(mei, { recursive: true });
  await mkdir(nested, { recursive: true });
  const files = [join(mei, 'mei.json'), join(nested, 'eliade.json'), join(group, '00-reference.json')];
  for (const file of files) await writeFile(file, '{}');
  await writeFile(join(mei, 'notes.md'), 'not import data');
  await mkdir(join(group, 'empty.json'));
  await symlink(group, join(mei, 'cycle'));
  await writeFile(join(root, 'outside.json'), '{}');
  await symlink(join(root, 'outside.json'), join(mei, 'linked.json'));
  assert.deepEqual(await collectImportFiles(group), [...files].sort());
  assert.deepEqual(await collectImportFiles(mei), [files[0]]);
  assert.deepEqual(await collectImportFiles(files[0]), [files[0]]);
});

test('rejects empty directory trees and missing paths', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'import-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested', 'notes.txt'), 'no JSON');
  await assert.rejects(collectImportFiles(root), /No JSON files found/);
  await assert.rejects(collectImportFiles(join(root, 'missing')), /Import path not found/);
});
