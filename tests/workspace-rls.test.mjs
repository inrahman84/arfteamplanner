import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('New workspaces can be returned to their creator before the membership trigger runs', async () => {
  for (const file of ['000_setup_database_baru.sql', '001_initial.sql']) {
    const sql = await readFile(new URL('../sql/' + file, import.meta.url), 'utf8');
    assert.match(sql, /create policy workspace_read[\s\S]*?using\(\(created_by=\(select auth\.uid\(\)\)\) or public\.is_workspace_member\(id\)\)/i,
      'Workspace creator SELECT access missing in ' + file);
    assert.match(sql, /create policy workspace_insert[\s\S]*?with check\(created_by=\(select auth\.uid\(\)\)\)/i);
  }
  const patch = await readFile(new URL('../sql/003_fix_workspace_creation_rls.sql', import.meta.url), 'utf8');
  assert.match(patch, /create policy workspace_read/i);
  assert.match(patch, /created_by\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(patch, /public\.is_workspace_member\(id\)/i);
});
