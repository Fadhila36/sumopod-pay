/**
 * Global test setup for both Vitest and Bun.
 * This ensures that if any test inadvertently attempts to make a real network request,
 * it will fail loudly rather than silently hitting a real server.
 */
globalThis.fetch = () => {
  throw new Error('NETWORK CALL DETECTED: You must provide a mock fetchImpl to FetchClient/SumoPodClient in tests. Real network calls are forbidden.');
};
