import { z } from "zod";

// The vocabulary for defining tutor events once. Each field carries its Zod validator (the parser's source of
// truth) plus metadata that tells the derivations in derive.ts how the field appears in the Gemini turn schema,
// the Live tool declarations and the client-bound event. Pure module: no server, Next or Supabase imports.

export type FieldMeta = {
  /** Description in the Live tool declaration. */
  description?: string;
  /**
   * Description in the flat Gemini turn schema. The flat schema has one property per field name, so set this on
   * the first event that uses the name and word it for every event that shares it.
   */
  turnDescription?: string;
  /** false: left out of the Gemini turn schema (the server fills it, e.g. a TTS audioUrl). */
  turn?: false;
  /** false: left out of the Live tool parameters. */
  live?: false;
  /** false: Live keeps this array's own bounds but drops the bounds inside its items (nested arrays). */
  liveItemBounds?: false;
  /**
   * Answer-key field (contract v3, Architecture §3.4). The model sends it, the parser keeps it, the server holds it
   * for grading, and `toClientEvent` strips it before the event leaves the server. Never shown to the learner.
   */
  serverOnly?: true;
};

export type FieldDef<Z extends z.ZodType = z.ZodType> = {
  readonly zod: Z;
  readonly meta: FieldMeta;
  /** Sub-fields when the field is an object, so their own metadata applies in the derivations. */
  readonly fields?: Readonly<Record<string, FieldDef>>;
};

export type FieldDefs = Record<string, FieldDef>;

export type ShapeOf<F extends FieldDefs> = { [K in keyof F]: F[K]["zod"] };

function shapeOf<F extends FieldDefs>(fields: F): ShapeOf<F> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, def] of Object.entries(fields)) shape[key] = def.zod;
  return shape as ShapeOf<F>;
}

/** A scalar or array field. Its JSON shape for Gemini/Live is derived from the Zod validator. */
export function field<Z extends z.ZodType>(zod: Z, meta: FieldMeta = {}): FieldDef<Z> {
  return { zod, meta };
}

/** An object field whose sub-fields are themselves definitions (so sub-field metadata is honoured). */
export function objectField<F extends FieldDefs>(fields: F, meta: FieldMeta = {}) {
  return { zod: z.object(shapeOf(fields)), meta, fields } as const;
}

export type EventMeta = {
  /** Contract version that introduced the event. Events are never removed: stored sessions replay. */
  since: number;
  /** false: not a Live tool (`say` is native audio in Live). */
  live?: false;
  /** Live tool description. Required for events that are Live tools. */
  liveDescription?: string;
};

export type EventSchema<T extends string, F extends FieldDefs> = z.ZodObject<{ type: z.ZodLiteral<T> } & ShapeOf<F>>;

export type EventDef<T extends string = string, F extends FieldDefs = FieldDefs> = {
  readonly type: T;
  readonly fields: F;
  readonly meta: EventMeta;
  /** The Zod object for this event, derived from its fields (plus any cross-field rule). */
  readonly schema: EventSchema<T, F>;
};

/**
 * Defines one event. `refine` adds a cross-field rule (e.g. show_board needs some content); it stays a ZodObject
 * in Zod 4, so the event still works as a discriminated-union option.
 */
export function defineEvent<T extends string, F extends FieldDefs>(
  type: T,
  fields: F,
  meta: EventMeta & {
    refine?: { check: (value: z.output<EventSchema<T, F>>) => boolean; message: string };
  },
): EventDef<T, F> {
  const base = z.object({ type: z.literal(type), ...shapeOf(fields) }) as EventSchema<T, F>;
  const schema = meta.refine ? base.refine(meta.refine.check, { message: meta.refine.message }) : base;
  const { refine: _refine, ...rest } = meta;
  void _refine;
  return { type, fields, meta: rest, schema };
}

/** Fields that must not reach the client, per event type. */
export function serverOnlyFieldsOf(def: EventDef): string[] {
  return Object.entries(def.fields)
    .filter(([, f]) => f.meta.serverOnly === true)
    .map(([key]) => key);
}
