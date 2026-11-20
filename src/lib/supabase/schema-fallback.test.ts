import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMissingColumnName,
  isMissingTableError,
  insertSingleWithSchemaFallback,
  updateWithSchemaFallback,
} from "./schema-fallback.ts";

test("extractMissingColumnName parses PostgREST and Postgres missing-column messages", () => {
  assert.equal(
    extractMissingColumnName(
      "Could not find the 'category' column of 'classroom_materials' in the schema cache"
    ),
    "category"
  );
  assert.equal(
    extractMissingColumnName(
      'column "requires_acknowledgement" of relation "classroom_materials" does not exist'
    ),
    "requires_acknowledgement"
  );
  assert.equal(extractMissingColumnName("permission denied"), null);
});

test("isMissingTableError detects absent tables", () => {
  assert.equal(
    isMissingTableError(
      "Could not find the table 'public.class_document_versions' in the schema cache"
    ),
    true
  );
  assert.equal(
    isMissingTableError('relation "class_document_versions" does not exist'),
    true
  );
  assert.equal(isMissingTableError("duplicate key value violates unique constraint"), false);
});

test("insertSingleWithSchemaFallback strips missing optional columns and retries", async () => {
  const attempts: Record<string, any>[] = [];
  const fakeSupabase = {
    from() {
      return {
        insert(payload: Record<string, any>) {
          attempts.push({ ...payload });
          return {
            select() {
              return {
                async single() {
                  if ("category" in payload) {
                    return {
                      data: null,
                      error: {
                        message:
                          "Could not find the 'category' column of 'classroom_materials' in the schema cache",
                      },
                    };
                  }
                  if ("visibility" in payload) {
                    return {
                      data: null,
                      error: {
                        message:
                          "Could not find the 'visibility' column of 'classroom_materials' in the schema cache",
                      },
                    };
                  }
                  return { data: { id: "mat-1", ...payload }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await insertSingleWithSchemaFallback(fakeSupabase, "classroom_materials", {
    title: "Week 1 Slides",
    category: "lecture_notes",
    visibility: "class",
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.id, "mat-1");
  assert.equal(attempts.length, 3);
  assert.deepEqual(attempts[2], { title: "Week 1 Slides" });
});

test("updateWithSchemaFallback strips missing columns during update", async () => {
  const attempts: Record<string, any>[] = [];
  const fakeSupabase = {
    from() {
      return {
        update(payload: Record<string, any>) {
          attempts.push({ ...payload });
          const builder = {
            eq() {
              return builder;
            },
            then(resolve: any) {
              if ("requires_acknowledgement" in payload) {
                resolve({
                  error: {
                    message:
                      "Could not find the 'requires_acknowledgement' column of 'classroom_materials' in the schema cache",
                  },
                });
              } else {
                resolve({ error: null });
              }
            },
          };
          return builder;
        },
      };
    },
  };

  const result = await updateWithSchemaFallback(
    fakeSupabase,
    "classroom_materials",
    { title: "Updated", requires_acknowledgement: true },
    { id: "mat-1" }
  );

  assert.equal(result.error, null);
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[1], { title: "Updated" });
});
