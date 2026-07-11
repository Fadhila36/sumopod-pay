export interface MockResponse {
  url?: string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  delayMs?: number;
}

export function createMockFetch(responses: MockResponse[]): {
  fetch: typeof fetch;
  calls: RequestInit[];
} {
  const calls: RequestInit[] = [];
  let currentResponseIndex = 0;

  const mockFetch = async (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push(init ?? {});
    
    // Fallback if responses run out
    const res = responses[currentResponseIndex] ?? { status: 500, body: { message: 'No mock response' } };
    currentResponseIndex++;

    if (res.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, res.delayMs));
    }

    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body,
      text: async () => JSON.stringify(res.body),
      headers: new Headers(res.headers ?? {}),
    } as unknown as Response;
  };

  return { fetch: mockFetch as typeof fetch, calls };
}
