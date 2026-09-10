/**
 * Re-export of the layout engine, by relative path.
 *
 * The API cannot import `@ale/engine` by package name. It is a workspace
 * symlink in node_modules whose entry point is a `.ts` file, and a serverless
 * bundler leaves node_modules external — so the deployed function was asked to
 * `import` TypeScript at runtime and refused. A relative path is inside the
 * source tree, so the bundler compiles it in like any other module.
 *
 * The ugliness is confined to this file; everything else imports `./engine.js`.
 */
export * from '../../../packages/engine/src/index.js';
