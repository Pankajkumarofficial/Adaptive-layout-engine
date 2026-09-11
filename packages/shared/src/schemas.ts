import { z } from 'zod';

/**
 * Runtime schemas for every wire-visible shape in the system.
 *
 * These are authored once here and consumed by:
 *  - the engine (`normalize` validates the spec before solving)
 *  - the Express API (request body validation)
 *  - the React client (JSON editor validation, import/export)
 *
 * The TypeScript types in `@ale/engine/types` are the compile-time mirror of
 * these schemas. `packages/engine/tests/schemaParity.test.ts` asserts the two
 * cannot drift.
 */

export const elementRoleSchema = z.enum([
  'logo',
  'headline',
  'subhead',
  'body',
  'cta',
  'hero',
  'background',
  'legal',
  'badge',
]);

export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a #rgb or #rrggbb hex color');

export const unitIntervalSchema = z.number().min(0).max(1);

export const textContentSchema = z.object({
  kind: z.literal('text'),
  /**
   * Empty is allowed. Clearing a field to retype it is an ordinary thing to
   * do, and rejecting the whole spec mid-keystroke makes the editor unusable.
   * The engine treats an element with nothing to say as nothing to place, and
   * reports it as dropped with that reason.
   */
  value: z.string(),
  maxLines: z.number().int().min(1).max(12).optional(),
  minFontPx: z.number().min(4).max(200).optional(),
});

export const imageContentSchema = z.object({
  kind: z.literal('image'),
  url: z.string().min(1),
  focalPoint: z.object({ x: unitIntervalSchema, y: unitIntervalSchema }).optional(),
  intrinsic: z.object({
    w: z.number().positive(),
    h: z.number().positive(),
  }),
});

export const shapeContentSchema = z.object({
  kind: z.literal('shape'),
  fill: hexColorSchema,
});

export const elementContentSchema = z.discriminatedUnion('kind', [
  textContentSchema,
  imageContentSchema,
  shapeContentSchema,
]);

/**
 * A cap of zero, or a stray string, is not worth rejecting a whole document
 * over — it means "no cap on that axis". Documents saved by an older build, or
 * hand-edited, heal instead of becoming unopenable.
 */
function dropNonPositiveAxes(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const source = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const axis of ['w', 'h'] as const) {
    const n = Number(source[axis]);
    if (Number.isFinite(n) && n > 0) out[axis] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const adElementSchema = z.object({
  id: z.string().min(1),
  role: elementRoleSchema,
  /** 0 = must never drop, 100 = drop first. */
  priority: z.number().int().min(0).max(100),
  content: elementContentSchema,
  /** Below this size the element carries no meaning and should be dropped instead. */
  minSize: z.object({ w: z.number().min(0), h: z.number().min(0) }).optional(),
  /**
   * Ceiling on the rendered frame, in px. Each axis is independent and
   * optional — an absent axis is uncapped — so setting one can never imply an
   * invalid value for the other.
   */
  maxSize: z
    .preprocess(
      dropNonPositiveAxes,
      z
        .object({ w: z.number().positive().optional(), h: z.number().positive().optional() })
        .optional(),
    )
    .optional(),
  /** width / height, enforced for logos and badges. */
  aspectLock: z.number().positive().optional(),
  pinTo: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional(),
});

export const themeSchema = z.object({
  palette: z.object({
    bg: hexColorSchema,
    fg: hexColorSchema,
    accent: hexColorSchema,
    ctaBg: hexColorSchema,
    ctaFg: hexColorSchema,
  }),
  fontFamily: z.string().min(1),
  /** Typographic scale ratio used to snap fitted font sizes. */
  scaleRatio: z.number().min(1).max(2).default(1.25),
  cornerRadius: z.number().min(0).default(0),
});

export const rulesSchema = z.object({
  neverDrop: z.array(z.string()).optional(),
  alwaysPairs: z.array(z.tuple([z.string(), z.string()])).optional(),
  minContrastRatio: z.number().min(1).max(21).optional(),
});

export const adSpecSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    elements: z.array(adElementSchema).min(1, 'a spec needs at least one element'),
    theme: themeSchema,
    rules: rulesSchema.optional(),
  })
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    spec.elements.forEach((el, i) => {
      if (ids.has(el.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['elements', i, 'id'],
          message: `duplicate element id "${el.id}"`,
        });
      }
      ids.add(el.id);
    });

    const unknown = (id: string) => !ids.has(id);
    spec.rules?.neverDrop?.forEach((id, i) => {
      if (unknown(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rules', 'neverDrop', i],
          message: `neverDrop references unknown element "${id}"`,
        });
      }
    });
    spec.rules?.alwaysPairs?.forEach((pair, i) => {
      pair.forEach((id, j) => {
        if (unknown(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rules', 'alwaysPairs', i, j],
            message: `alwaysPairs references unknown element "${id}"`,
          });
        }
      });
    });
  });

export const surfaceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  width: z.number().positive().max(20000),
  height: z.number().positive().max(20000),
  dpr: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  safeArea: z
    .object({
      top: z.number().min(0),
      right: z.number().min(0),
      bottom: z.number().min(0),
      left: z.number().min(0),
    })
    .optional(),
  interactionHint: z.enum(['tap', 'click', 'remote', 'none']),
});

export type AdSpecInput = z.input<typeof adSpecSchema>;
export type AdSpecParsed = z.output<typeof adSpecSchema>;
export type SurfaceParsed = z.output<typeof surfaceSchema>;
