// Pure helpers for error monitoring (no Next/Supabase imports so tests can load them directly).
import crypto from 'crypto';

// Remove anything that could be personal or secret before storing.
export function scrub(text, max = 500) {
  return String(text ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    .replace(/\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){4,7}\b/gi, '[ip]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[token]')
    .replace(/\b(bearer|token|key|secret|password|apikey|api_key|sig|signature)([=: ]+)[^\s&"']+/gi, '$1$2[redacted]')
    .replace(/(https?:\/\/[^\s?#"']+)\?[^\s"']*/g, '$1?[query]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]')
    .slice(0, max);
}

// Collapse ids/numbers so the same bug groups into one row.
export function normalizeForFingerprint(s) {
  return String(s || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\b[0-9a-f]{12,}\b/gi, ':hex')
    .replace(/\d+/g, '0')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function routeTemplate(path) {
  return String(path || '').split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .slice(0, 120) || '/';
}

// Top stack frame (file + function, no line/column numbers) helps separate different bugs with the same message.
function topFrame(stack) {
  const line = String(stack || '').split('\n').map((l) => l.trim()).find((l) => /^at |@/.test(l)) || '';
  return line.replace(/:\d+:\d+\)?$/, '').replace(/\?[^\s)]*/g, '').slice(0, 200);
}

export function fingerprint(source, route, message, stack) {
  return crypto.createHash('sha256')
    .update(`${source}|${routeTemplate(route)}|${normalizeForFingerprint(message)}|${normalizeForFingerprint(topFrame(stack))}`)
    .digest('hex').slice(0, 32);
}
