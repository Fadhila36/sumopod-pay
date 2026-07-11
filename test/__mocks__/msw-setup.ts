/**
 * MSW server setup for Vitest.
 *
 * This file is loaded via vitest.config.ts setupFiles.
 */
import { setupServer } from 'msw/node';
import { handlers } from './msw-handlers.js';
import { afterAll, afterEach, beforeAll } from 'vitest';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
