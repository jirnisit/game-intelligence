import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function collectImportFiles(input) {
  const info = await stat(input).catch(() => { throw new Error('Import path not found. Create database/data JSON files or pass a file/directory path.'); });
  if (!info.isDirectory()) return [input];
  const files = [];
  async function scan(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
    }
  }
  // Do not follow nested symlinks: avoid cycles or importing outside the selected tree.
  await scan(input);
  if (!files.length) throw new Error('No JSON files found; nothing imported');
  return files.sort();
}
