const MISSING_COLUMN_PATTERNS = [
  /Could not find the '([^']+)' column of '[^']+' in the schema cache/i,
  /column ["']?([a-zA-Z0-9_]+)["']? of relation ["'][^"']+["'] does not exist/i,
];

export function extractMissingColumnName(message?: string | null): string | null {
  if (!message) return null;
  for (const pattern of MISSING_COLUMN_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function isMissingTableError(message?: string | null): boolean {
  if (!message) return false;
  return (
    /Could not find the table '[^']+' in the schema cache/i.test(message) ||
    /relation ["'][^"']+["'] does not exist/i.test(message)
  );
}

/**
 * Inserts a row and automatically strips any optional column rejected by PostgREST's
 * schema cache (e.g., when a newer additive migration hasn't run in production yet).
 */
export async function insertSingleWithSchemaFallback<T = any>(
  supabase: any,
  table: string,
  payload: Record<string, any>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const candidate: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase
      .from(table)
      .insert(candidate)
      .select()
      .single();

    if (!error) {
      return { data: data as T, error: null };
    }

    const missingCol = extractMissingColumnName(error.message);
    if (missingCol && missingCol in candidate) {
      delete candidate[missingCol];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: `Failed to insert into ${table}` } };
}

/**
 * Updates rows matching exact equality filters while automatically stripping
 * any optional column missing from PostgREST's schema cache.
 */
export async function updateWithSchemaFallback(
  supabase: any,
  table: string,
  payload: Record<string, any>,
  filters: Record<string, any>
): Promise<{ error: { message: string } | null }> {
  const candidate: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 8; attempt++) {
    let query = supabase.from(table).update(candidate);
    for (const [col, val] of Object.entries(filters)) {
      query = query.eq(col, val);
    }

    const { error } = await query;
    if (!error) {
      return { error: null };
    }

    const missingCol = extractMissingColumnName(error.message);
    if (missingCol && missingCol in candidate) {
      delete candidate[missingCol];
      continue;
    }

    return { error };
  }

  return { error: { message: `Failed to update ${table}` } };
}
