// Minimal untyped view of the Supabase client for tables/functions that are not in the generated
// `Database` types yet (P2 migrations are applied after this code ships). Types only.

export type DbError = { code?: string | null; message?: string | null; details?: string | null };
export type DbResult<T = unknown> = { data: T | null; error: DbError | null };

export type LooseQuery = PromiseLike<DbResult> & {
  select: (columns?: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  neq: (column: string, value: unknown) => LooseQuery;
  in: (column: string, values: readonly unknown[]) => LooseQuery;
  is: (column: string, value: unknown) => LooseQuery;
  order: (column: string, opts?: { ascending?: boolean }) => LooseQuery;
  limit: (n: number) => LooseQuery;
  insert: (rows: unknown) => LooseQuery;
  update: (values: unknown) => LooseQuery;
  upsert: (rows: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => LooseQuery;
  delete: () => LooseQuery;
  maybeSingle: () => LooseQuery;
  single: () => LooseQuery;
};

export type LooseDb = {
  from: (table: string) => LooseQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => LooseQuery;
};

export function loose(client: unknown): LooseDb {
  return client as LooseDb;
}
