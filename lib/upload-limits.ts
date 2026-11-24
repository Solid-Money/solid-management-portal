/**
 * What `/api/upload` stores: shared by the route and the browser helper, so
 * neither drifts from the other. Kept apart from `lib/upload.ts`, which pulls
 * in the Firebase client the route must not load.
 */

/** Image types `/api/upload` stores. */
export const UPLOAD_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];

/** Vercel caps a route body at about 4.5 MB; stay under it. */
export const UPLOAD_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
