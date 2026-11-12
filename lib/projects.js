// Projects: folders in the Library (migration 011). Shared helpers, safe for the client.
export const MAX_PROJECTS = 50;
export const MAX_NAME = 40;
// A project name as it is stored: single spaces, no edge spaces, at most MAX_NAME characters. '' if nothing is left.
export const cleanName = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim() : '');
// True when the database says the projects table or the project_id column doesn't exist (migration 011 not run yet).
export const notInstalled = (e) => Boolean(e) && /projects|project_id|schema cache|PGRST20[45]|42P01|42703/i.test(`${e.code || ''} ${e.message || ''}`);
