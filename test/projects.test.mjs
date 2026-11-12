import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanName, notInstalled, MAX_NAME } from '../lib/projects.js';

test('a project name is trimmed, single-spaced and capped', () => {
  assert.equal(cleanName('  Summer   campaign \n 2026 '), 'Summer campaign 2026');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName(null), '');
  assert.equal(cleanName({}), '');
  assert.equal(cleanName('x'.repeat(100)).length, MAX_NAME);
  assert.equal(cleanName('קמפיין קיץ'), 'קמפיין קיץ');
});

test('a missing table or column is recognised, other errors are not', () => {
  assert.equal(notInstalled({ code: '42P01', message: 'relation "public.projects" does not exist' }), true);
  assert.equal(notInstalled({ code: 'PGRST205', message: "Could not find the table 'public.projects' in the schema cache" }), true);
  assert.equal(notInstalled({ code: '42703', message: 'column images.project_id does not exist' }), true);
  assert.equal(notInstalled({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
  assert.equal(notInstalled(null), false);
});

test('migration 011 only adds: no drop, delete, update, truncate or type change', () => {
  const sql = readFileSync(new URL('../supabase/migrations/011_projects.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|update\s+\w|truncate|alter\s+column|rename)\b/i);
  assert.match(sql, /create table if not exists public\.projects/);
  assert.match(sql, /add column if not exists project_id uuid null/);
  assert.match(sql, /on delete set null/); // deleting a project never deletes its images
});

test('both routes act only on the caller\'s own rows', () => {
  const a = readFileSync(new URL('../app/api/projects/route.js', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../app/api/projects/items/route.js', import.meta.url), 'utf8');
  for (const part of a.split("from('projects')").slice(1)) assert.match(part.split(';')[0], /creator_id/); // every projects query names the owner
  assert.match(b, /from\('images'\)\.update\(\{ project_id: project \}\)\.eq\('creator_id', creator\.id\)/);
  assert.match(b, /from\('projects'\)\.select\('id'\)\.eq\('id', project\)\.eq\('creator_id', creator\.id\)/);
  for (const src of [a, b]) assert.match(src, /accountGate\(request\)/);
});

test('a video job remembers the project it was started in', async () => {
  const { jobFromRow } = await import('../lib/videoJobCore.js');
  const row = { prediction_id: 'abc123', uid: 'u1', kind: 'video:veo-lite', cost: 36, prompt: 'x', aspect_ratio: '16:9' };
  assert.equal(jobFromRow(row).j, undefined);
  assert.equal(jobFromRow({ ...row, project_id: '22222222-2222-4222-8222-000000000001' }).j, '22222222-2222-4222-8222-000000000001');
  const sql = readFileSync(new URL('../supabase/migrations/012_video_job_project.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|update\s+\w|truncate|alter\s+column|rename)\b/i);
  assert.match(sql, /add column if not exists project_id uuid null/);
  // The start route only accepts a project the caller owns, and saving never fails because of the project.
  const route = readFileSync(new URL('../app/api/animate/route.js', import.meta.url), 'utf8');
  assert.equal(route.split('ownedProject(creator.id, body?.project)').length - 1, 2);
  const owner = readFileSync(new URL('../lib/projectOwner.js', import.meta.url), 'utf8');
  assert.match(owner, /eq\('id', id\)\.eq\('creator_id', creatorId\)/);
});
