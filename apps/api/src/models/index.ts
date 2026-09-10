import mongooseDefault from 'mongoose';
import type { Model, Schema as SchemaType, Types } from 'mongoose';

/**
 * Mongoose is CommonJS. Node's ESM loader only detects some of its named
 * exports, and `models` is not one of them — importing it by name typechecks
 * and passes under Vitest's interop, then throws SyntaxError the moment the
 * server actually starts. Destructuring the default export is the form that
 * works in both.
 */
const { Schema, model, models } = mongooseDefault;

/**
 * Specs and surfaces are stored as opaque documents and validated with the
 * shared zod schemas at the edge. Mirroring the whole AdSpec in Mongoose would
 * give two definitions of the same thing that could disagree; zod is the one
 * the client and the engine already trust.
 *
 * Document types are written by hand rather than inferred: `InferSchemaType`
 * over `Schema.Types.Mixed` expands badly enough to exhaust the type checker.
 */

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdSpecDocType {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  spec: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurfaceDocType {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  surface: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShareLinkDocType {
  _id: Types.ObjectId;
  slug: string;
  spec: Types.ObjectId;
  owner: Types.ObjectId;
  createdAt: Date;
}

export interface RenderLogDocType {
  _id: Types.ObjectId;
  specId: Types.ObjectId;
  surfaceId: string;
  archetype: string;
  droppedIds: string[];
  solveMs: number;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

const adSpecSchema = new Schema<AdSpecDocType>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    spec: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
adSpecSchema.index({ owner: 1, name: 1 });

const surfaceSchema = new Schema<SurfaceDocType>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    surface: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

const shareLinkSchema = new Schema<ShareLinkDocType>(
  {
    slug: { type: String, required: true, unique: true },
    spec: { type: Schema.Types.ObjectId, ref: 'AdSpecDoc', required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

/**
 * One row per (spec, surface) solve. This is the dataset an archetype chooser
 * would learn from: which elements the engine actually sacrifices, on which
 * shapes, and how long deciding took.
 */
const renderLogSchema = new Schema<RenderLogDocType>(
  {
    specId: { type: Schema.Types.ObjectId, ref: 'AdSpecDoc', required: true, index: true },
    surfaceId: { type: String, required: true, index: true },
    archetype: { type: String, required: true },
    droppedIds: { type: [String], default: [] },
    solveMs: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** `models[...] ?? model(...)` keeps hot reload and repeated test setup safe. */
function define<T>(name: string, schema: SchemaType<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const User = define<UserDoc>('User', userSchema);
export const AdSpecDoc = define<AdSpecDocType>('AdSpecDoc', adSpecSchema);
export const SurfaceDoc = define<SurfaceDocType>('SurfaceDoc', surfaceSchema);
export const ShareLink = define<ShareLinkDocType>('ShareLink', shareLinkSchema);
export const RenderLog = define<RenderLogDocType>('RenderLog', renderLogSchema);
