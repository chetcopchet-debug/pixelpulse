// Upload request validation (pure; unit-tested).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const OK_TYPES = /^(image\/(jpeg|jpg|png|webp|gif|heic|heif|avif)|application\/octet-stream)?$/i;
// Server-side check of what the client says it will upload (the bucket limits enforce it again on the PUT).
export function validateUploadRequest(body) {
  const size = Number(body?.size);
  if (!Number.isFinite(size) || size <= 0) return { status: 400, error: 'That file is empty. Please pick a photo again.' };
  if (size > MAX_UPLOAD_BYTES) return { status: 413, error: 'Photo is too large (max 8MB).' };
  if (body?.type !== undefined && (typeof body.type !== 'string' || !OK_TYPES.test(body.type))) return { status: 415, error: 'Only photos can be uploaded (JPG, PNG, WebP, HEIC).' };
  return null;
}

