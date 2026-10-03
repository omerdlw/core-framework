type QueryResult = { count?: number | null; data?: any; error?: any };

export interface FakeSupabaseOptions {
  adminDeleteError?: any;
  claims?: Record<string, any> | null;
  rpc?: Record<string, QueryResult>;
  tables?: Record<string, QueryResult | QueryResult[]>;
}

export interface RecordedQuery {
  ops: [string, any[]][];
  table: string;
}

export interface FakeSupabase {
  adminDeletes: string[];
  queries: RecordedQuery[];
  restore: () => void;
  rpcCalls: [string, any][];
}

const EMPTY: QueryResult = { data: null, error: null };

function queryBuilder(
  table: string,
  queries: RecordedQuery[],
  result: QueryResult,
): any {
  const record: RecordedQuery = { ops: [], table };
  queries.push(record);
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return (...args: any[]) => {
          record.ops.push([String(prop), args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}
export function installFakeSupabase({
  adminDeleteError = null,
  claims = null,
  rpc = {},
  tables = {},
}: FakeSupabaseOptions = {}): FakeSupabase {
  const queries: RecordedQuery[] = [];
  const cursors = new Map<string, number>();
  const sequence = (table: string, results: QueryResult[]) => {
    const index = cursors.get(table) ?? 0;
    cursors.set(table, index + 1);
    return results[Math.min(index, results.length - 1)];
  };
  const rpcCalls: [string, any][] = [];
  const adminDeletes: string[] = [];

  const client = {
    auth: {
      getClaims: async () => ({
        data: claims ? { claims } : null,
        error: claims ? null : { message: "no session" },
      }),
    },
    from: (table: string) => {
      const configured = tables[table];
      const result = Array.isArray(configured)
        ? sequence(table, configured)
        : (configured ?? EMPTY);
      return queryBuilder(table, queries, result);
    },
    rpc: async (name: string, args: any) => {
      rpcCalls.push([name, args]);
      return rpc[name] ?? EMPTY;
    },
  };
  const admin = {
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          adminDeletes.push(id);
          return { error: adminDeleteError };
        },
      },
    },
  };

  const holder = globalThis as any;
  const previous = holder.__bfSupabase;
  holder.__bfSupabase = { admin: () => admin, server: async () => client };

  return {
    adminDeletes,
    queries,
    restore: () => {
      holder.__bfSupabase = previous;
    },
    rpcCalls,
  };
}

export const SITE = "https://app.example.com";

export function apiRequest(
  path: string,
  {
    body,
    headers = {},
    method = "GET",
    origin = SITE,
  }: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
    origin?: string | null;
  } = {},
): Request {
  return new Request(`${SITE}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(origin ? { origin } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    method,
  });
}

export const signedIn = (id: string, extra: Record<string, any> = {}) => ({
  aal: "aal1",
  email: `${id}@example.com`,
  session_id: `session-${id}`,
  sub: id,
  ...extra,
});
