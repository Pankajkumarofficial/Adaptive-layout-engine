import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEMO_SPEC } from './engine.js';
import type { AdSpec } from './engine.js';
import { loadDotenv, loadEnv } from './env.js';
import { AdSpecDoc, ShareLink, User } from './models/index.js';
import { makeSlug } from './routes/specs.js';

/**
 * Puts a demo account and three specs in the database, so a fresh deployment
 * has something to show before anyone has signed up.
 */
const DEMO_EMAIL = 'demo@adaptive-layout.dev';
const DEMO_PASSWORD = 'proof the layout';

function variant(name: string, patch: (spec: AdSpec) => AdSpec): AdSpec {
  return patch({ ...DEMO_SPEC, id: name.toLowerCase().replace(/\W+/g, '-'), name });
}

const SPECS: AdSpec[] = [
  DEMO_SPEC,
  variant('Longform — copy that will not fit', (s) => ({
    ...s,
    elements: s.elements.map((el) =>
      el.id === 'headline'
        ? {
            ...el,
            content: {
              kind: 'text',
              value:
                'The trail does not care how far you have already come, only where you point your boots next',
              maxLines: 4,
              minFontPx: 14,
            },
          }
        : el,
    ),
  })),
  variant('Minimal — three elements, nothing to drop', (s) => ({
    ...s,
    elements: s.elements.filter((el) => ['bg', 'headline', 'cta'].includes(el.id)),
    rules: { neverDrop: ['headline', 'cta'], minContrastRatio: 4.5 },
  })),
];

async function main(): Promise<void> {
  loadDotenv();
  const env = loadEnv();
  await mongoose.connect(env.MONGODB_URI);

  const user =
    (await User.findOne({ email: DEMO_EMAIL })) ??
    (await User.create({
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    }));

  await AdSpecDoc.deleteMany({ owner: user._id });
  const created = await AdSpecDoc.insertMany(
    SPECS.map((spec) => ({ owner: user._id, name: spec.name, spec })),
  );

  await ShareLink.deleteMany({ owner: user._id });
  const showcase = created[0];
  let slug: string | null = null;
  if (showcase !== undefined) {
    slug = makeSlug();
    await ShareLink.create({ slug, spec: showcase._id, owner: user._id });
  }

  console.log(`seeded ${created.length} specs for ${DEMO_EMAIL}`);
  console.log(`password: ${DEMO_PASSWORD}`);
  if (slug !== null) console.log(`share link: /s/${slug}`);

  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
