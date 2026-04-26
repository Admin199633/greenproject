/**
 * Origin-relative API root, including the Next.js basePath.
 * Use this for all client-side fetch() calls so they keep working under /green.
 *
 * The basePath is configured statically in next.config.mjs; if it ever needs to
 * become dynamic, route this through process.env.NEXT_PUBLIC_BASE_PATH.
 */
export const API_BASE = "/green/api";
