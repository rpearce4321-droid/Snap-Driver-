export type Env = {
  DB: {
    prepare: (query: string) => {
      bind: (...args: any[]) => any;
      first: <T = unknown>(col?: string) => Promise<T | null>;
      run: () => Promise<any>;
      all: <T = unknown>() => Promise<{ results: T[] }>;
    };
    batch: (statements: any[]) => Promise<any[]>;
  };
};

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function badRequest(message: string) {
  return json({ ok: false, error: message }, { status: 400 });
}

export function serverError(message: string) {
  return json({ ok: false, error: message }, { status: 500 });
}

export function requireDb(env: Env) {
  if (!env.DB) {
    throw new Error("DB binding not configured");
  }
  return env.DB;
}
