/**
 * Colours are declared as CSS variables holding space-separated RGB channels,
 * so one token set serves both themes and Tailwind's alpha modifiers
 * (`bg-reg/5`, `border-rule/60`) still work. The values live in index.css.
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        board: token('--c-board'),
        'board-2': token('--c-board-2'),
        paper: token('--c-paper'),
        card: token('--c-card'),
        rule: token('--c-rule'),
        'rule-2': token('--c-rule-2'),
        proof: token('--c-proof'),
        ink: token('--c-ink'),
        'ink-2': token('--c-ink-2'),
        'ink-3': token('--c-ink-3'),
        'on-accent': token('--c-on-accent'),
        guide: token('--c-guide'),
        'guide-2': token('--c-guide-2'),
        reg: token('--c-reg'),
        mark: token('--c-mark'),
      },
      fontFamily: {
        /**
         * Two voices, used for different jobs.
         *
         * Bodoni is the face advertising layout was actually set in: a severe
         * didone with real contrast. It is spent in one place — the masthead
         * and the panel headings — so it carries authority instead of
         * decorating everything.
         *
         * Archivo does all the work: labels, controls, the trace, the numbers.
         * It is a workmanlike grotesque that holds up at 11px, which is where
         * most of this interface lives.
         *
         * Courier Prime appears only inside the raw JSON editor, where fixed
         * advances are a functional requirement rather than a style.
         */
        display: ['"Bodoni Moda"', 'Didot', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"Courier Prime"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { bench: '1px' },
      fontSize: {
        micro: ['11px', { lineHeight: '14px' }],
        tiny: ['12px', { lineHeight: '16px' }],
      },
      boxShadow: {
        paste: '0 1px 0 rgb(0 0 0 / 0.25), 0 10px 24px -12px rgb(0 0 0 / 0.55)',
      },
    },
  },
  plugins: [],
};
