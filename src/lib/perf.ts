/**
 * Lightweight server-side timing helper.
 *
 * Logs `[perf] <label> <elapsedMs>ms` after the wrapped promise settles.
 * Intended for diagnosing slow page loaders / Prisma query bursts in prod.
 */
export async function perf<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[perf] ${label} ${Date.now() - t0}ms`);
  }
}
