/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * A paste-up board, not a dashboard.
         *
         * Before layouts were solved they were built: artwork pasted onto grey
         * board, guides ruled in non-photo blue because that ink did not show
         * up on the camera, and anything to be cut marked in registration red.
         * The whole palette is that bench, so the app looks like the craft it
         * automates rather than like every other developer tool.
         */
        board: '#c8cbc1',
        'board-2': '#bcbfb4',
        paper: '#e2e1da',
        card: '#f2f1ec',
        rule: '#a7a99d',
        'rule-2': '#8d9084',
        /** The proofing surround: darker, so colourful artwork reads honestly. */
        proof: '#767a70',
        ink: '#1a1a17',
        'ink-2': '#54544c',
        'ink-3': '#6b6b61',
        'on-accent': '#f5f5f0',
        /** Non-photo blue: guides, regions, structure. */
        guide: '#1f6fa8',
        'guide-2': '#7fc6e8',
        /** Registration red: cut marks, drops, anything sacrificed. */
        reg: '#bf3126',
        /** Warning ochre, from a proofing pencil. */
        mark: '#a3670c',
      },
      fontFamily: {
        // Fraunces speaks; Archivo Narrow labels; Courier Prime only where the
        // content is literally typed data.
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Archivo Narrow"', 'system-ui', 'sans-serif'],
        mono: ['"Courier Prime"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { bench: '1px' },
      fontSize: {
        micro: ['11px', { lineHeight: '14px' }],
        tiny: ['12px', { lineHeight: '16px' }],
      },
      boxShadow: {
        // Artwork pasted onto the board sits slightly above it.
        paste: '0 1px 0 rgba(0,0,0,0.25), 0 10px 24px -12px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
};
