import { useEffect, useRef, useState } from 'react';
import { DEMO_SPEC } from '@ale/engine';
import { useSearchParams } from 'react-router-dom';
import { usePlayground } from '../lib/store';
import { useSolve } from '../lib/useSolve';
import { PriorityLadder } from '../components/PriorityLadder';
import { ElementInspector } from '../components/ElementInspector';
import { SurfaceCanvas } from '../components/SurfaceCanvas';
import { Inspector } from '../components/Inspector';
import { MatrixView } from '../components/MatrixView';
import { DropRates } from '../components/DropRates';
import { JsonView } from '../components/JsonView';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Swatch } from '../components/Field';
import { Library } from '../components/Library';
import { useAppTheme, type AppTheme } from '../lib/theme';
import { SpecError, type AdSpec } from '@ale/engine';

type LeftTab = 'elements' | 'theme' | 'json' | 'library';
type RightTab = 'decisions' | 'drops';

export function Playground() {
  const spec = usePlayground((s) => s.spec);
  const surface = usePlayground((s) => s.surface);
  const selectedId = usePlayground((s) => s.selectedElementId);
  const [tab, setTab] = useState<LeftTab>('elements');
  // 1280px is where both rails plus a usable canvas stop fitting. Below it the
  // inspector starts closed; below 1024px the spec rail does too. They stay
  // togglable at every width, so nothing is unreachable on a small screen.
  const [showSpec, setShowSpec] = useState(() => wider(1024));
  const [showInspector, setShowInspector] = useState(() => wider(1280));
  const [rightTab, setRightTab] = useState<RightTab>('decisions');
  const [params] = useSearchParams();
  const setSpec = usePlayground((s) => s.setSpec);
  const selectPreset = usePlayground((s) => s.selectPreset);

  // `?demo=1` is the link handed to someone with no account and no context:
  // it must show the showcase, never whatever was left in this browser.
  const demo = params.get('demo') === '1';
  useEffect(() => {
    if (!demo) return;
    setSpec(DEMO_SPEC);
    selectPreset('story-1080x1920');
  }, [demo, setSpec, selectPreset]);

  const { result, error, ms } = useSolve(spec, surface);
  const selected = spec.elements.find((el) => el.id === selectedId);

  return (
    <div className="board-tooth flex h-full flex-col bg-board text-ink">
      <TitleBar
        showSpec={showSpec}
        showInspector={showInspector}
        onToggleSpec={() => setShowSpec((v) => !v)}
        onToggleInspector={() => setShowInspector((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        {showSpec && (
          <aside className="flex w-[264px] shrink-0 flex-col border-r border-rule-2 bg-paper xl:w-[300px]">
            <Tabs tab={tab} onChange={setTab} />
            <ErrorBoundary label="The spec editor">
              {tab === 'json' ? (
                <JsonView />
              ) : tab === 'library' ? (
                <Library />
              ) : tab === 'theme' ? (
                <ThemeEditor />
              ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                  <PriorityLadder result={result} />
                  {selected !== undefined && <ElementInspector element={selected} />}
                </div>
              )}
            </ErrorBoundary>
            <SpecFileBar />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary label="The canvas">
            {error !== null ? <SolveError error={error} /> : <SurfaceCanvas result={result} />}
          </ErrorBoundary>
          <ErrorBoundary label="The matrix">
            <MatrixView spec={spec} />
          </ErrorBoundary>
        </main>

        {showInspector && (
          <aside className="flex w-[330px] shrink-0 flex-col border-l border-rule-2 bg-paper xl:w-[400px]">
            <h2 className="border-b border-rule px-4 py-2.5 font-display text-[17px] font-medium leading-none">
              What the engine decided
            </h2>
            <div className="flex border-b border-rule" role="tablist">
              {(
                [
                  ['decisions', 'This surface'],
                  ['drops', 'Drop rates'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={rightTab === id}
                  onClick={() => setRightTab(id)}
                  className={`flex-1 border-b-2 px-3 py-1.5 text-tiny font-medium transition-colors ${
                    rightTab === id
                      ? 'border-ink bg-card text-ink'
                      : 'border-transparent text-ink-2 hover:bg-card/60 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ErrorBoundary label="The inspector">
              {rightTab === 'drops' ? (
                <DropRates spec={spec} />
              ) : result !== null ? (
                <Inspector result={result} ms={ms} />
              ) : (
                <p className="p-4 text-tiny text-ink-3">Nothing to show until the spec is valid.</p>
              )}
            </ErrorBoundary>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Media query evaluated once, for the initial rail state. */
function wider(px: number): boolean {
  return typeof window === 'undefined' ? true : window.matchMedia(`(min-width: ${px}px)`).matches;
}

interface TitleBarProps {
  showSpec: boolean;
  showInspector: boolean;
  onToggleSpec: () => void;
  onToggleInspector: () => void;
}

function TitleBar({ showSpec, showInspector, onToggleSpec, onToggleInspector }: TitleBarProps) {
  const spec = usePlayground((s) => s.spec);
  const surface = usePlayground((s) => s.surface);
  const { theme, toggle } = useAppTheme();

  return (
    <header className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b-2 border-ink bg-paper px-4 pb-2 pt-2.5">
      <h1 className="font-display text-[27px] font-bold leading-[0.92] tracking-[-0.018em]">
        Adaptive Layout Engine
      </h1>
      <p className="mb-px hidden max-w-[42ch] text-tiny leading-snug text-ink-2 lg:block">
        One spec, solved for each surface. Nothing here is a template &mdash; every position below
        is a decision, and the engine shows its working.
      </p>

      <div className="mb-px ml-auto flex items-end gap-4">
        <dl className="flex items-end gap-4 text-right">
          <div className="hidden sm:block">
            <dt className="text-micro leading-none text-ink-3">Piece</dt>
            <dd className="text-tiny font-semibold">{spec.name}</dd>
          </div>
          <div>
            <dt className="text-micro leading-none text-ink-3">Surface</dt>
            <dd className="tabular text-tiny">
              {surface.width} &times; {surface.height}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-1">
          <RailToggle label="Spec" on={showSpec} onClick={onToggleSpec} />
          <RailToggle label="Decisions" on={showInspector} onClick={onToggleInspector} />
          <ThemeToggle theme={theme} onClick={toggle} />
        </div>
      </div>
    </header>
  );
}

function RailToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={`${on ? 'Hide' : 'Show'} the ${label.toLowerCase()} panel`}
      className={`border px-2 py-1 text-micro transition-colors ${
        on
          ? 'border-ink bg-ink text-on-accent'
          : 'border-rule-2 text-ink-2 hover:border-ink hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Light is the paste-up board under daylight; dark is the same bench under a
 * darkroom safelight. The button names the state you are in and switches to
 * the other, with the action spelled out for screen readers.
 */
function ThemeToggle({ theme, onClick }: { theme: AppTheme; onClick: () => void }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      title={`Switch to ${dark ? 'light' : 'dark'} theme`}
      className="ml-1 flex items-center gap-1.5 border border-rule-2 px-2 py-1 text-micro text-ink-2 transition-colors hover:border-ink hover:text-ink"
    >
      <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        {dark ? (
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" fill="currentColor" />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.2 1.2M11.8 11.8 13 13M13 3l-1.2 1.2M4.2 11.8 3 13" />
          </g>
        )}
      </svg>
      {dark ? 'Darkroom' : 'Daylight'}
    </button>
  );
}

function Tabs({ tab, onChange }: { tab: LeftTab; onChange: (t: LeftTab) => void }) {
  const tabs: { id: LeftTab; label: string }[] = [
    { id: 'elements', label: 'Elements' },
    { id: 'theme', label: 'Theme' },
    { id: 'json', label: 'JSON' },
    { id: 'library', label: 'Library' },
  ];
  return (
    <div className="flex border-b border-rule" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 border-b-2 px-3 py-2 text-tiny font-medium transition-colors ${
            tab === t.id
              ? 'border-ink bg-card text-ink'
              : 'border-transparent text-ink-2 hover:bg-card/60 hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ThemeEditor() {
  const theme = usePlayground((s) => s.spec.theme);
  const setPalette = usePlayground((s) => s.setPalette);
  const setTheme = usePlayground((s) => s.setTheme);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
      {(
        [
          ['bg', 'Background'],
          ['fg', 'Text'],
          ['accent', 'Accent'],
          ['ctaBg', 'Button fill'],
          ['ctaFg', 'Button text'],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="mb-3 flex items-center justify-between">
          <span className="text-tiny text-ink-2">{label}</span>
          <Swatch value={theme.palette[key]} onChange={(v) => setPalette({ [key]: v })} />
        </div>
      ))}

      <label className="mb-3 block">
        <span className="mb-1 block text-tiny text-ink-3">
          Type scale &mdash; fitted sizes snap to this ratio
        </span>
        <input
          type="range"
          min={1}
          max={1.8}
          step={0.025}
          value={theme.scaleRatio}
          onChange={(e) => setTheme({ scaleRatio: Number(e.target.value) })}
          className="w-full accent-guide"
        />
        <span className="tabular text-tiny tabular text-ink-2">{theme.scaleRatio.toFixed(3)}</span>
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-tiny text-ink-3">Corner radius</span>
        <input
          type="range"
          min={0}
          max={40}
          value={theme.cornerRadius}
          onChange={(e) => setTheme({ cornerRadius: Number(e.target.value) })}
          className="w-full accent-guide"
        />
        <span className="tabular text-tiny tabular text-ink-2">{theme.cornerRadius}px</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-tiny text-ink-3">
          Font family &mdash; the estimator has metrics for Inter, Georgia and a monospace
        </span>
        <select
          value={theme.fontFamily}
          onChange={(e) => setTheme({ fontFamily: e.target.value })}
          className="w-full rounded-bench border border-rule bg-card px-2 py-1 text-tiny text-ink focus:border-guide focus:outline-none"
        >
          <option value="Inter, system-ui, sans-serif">Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value='"IBM Plex Mono", monospace'>IBM Plex Mono</option>
        </select>
      </label>
    </div>
  );
}

/** The smallest spec the schema accepts: a ground, something to say, something to do. */
function blankSpec(theme: AdSpec['theme']): AdSpec {
  return {
    id: `spec-${Date.now().toString(36)}`,
    name: 'Untitled ad',
    elements: [
      {
        id: 'bg',
        role: 'background',
        priority: 0,
        content: { kind: 'shape', fill: theme.palette.bg },
      },
      {
        id: 'headline',
        role: 'headline',
        priority: 0,
        content: { kind: 'text', value: 'Your headline here', maxLines: 3, minFontPx: 14 },
      },
      {
        id: 'cta',
        role: 'cta',
        priority: 5,
        content: { kind: 'text', value: 'Get started', maxLines: 1, minFontPx: 12 },
        minSize: { w: 96, h: 32 },
      },
    ],
    theme,
    rules: { neverDrop: ['headline', 'cta'], minContrastRatio: 4.5 },
  };
}

function SpecFileBar() {
  const spec = usePlayground((s) => s.spec);
  const setSpec = usePlayground((s) => s.setSpec);
  const resetSpec = usePlayground((s) => s.resetSpec);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportSpec = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${spec.id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importSpec = async (file: File) => {
    try {
      setSpec(JSON.parse(await file.text()) as AdSpec);
    } catch (err) {
      console.error('[playground] could not read that file', err);
    }
  };

  return (
    <div className="flex gap-2 border-t border-rule px-4 py-2">
      <button
        type="button"
        onClick={() => setSpec(blankSpec(spec.theme))}
        title="Start a new ad from three elements"
        className="text-tiny text-ink-3 hover:text-ink"
      >
        New
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="text-tiny text-ink-3 hover:text-ink"
      >
        Import
      </button>
      <button type="button" onClick={exportSpec} className="text-tiny text-ink-3 hover:text-ink">
        Export
      </button>
      <button
        type="button"
        onClick={resetSpec}
        className="ml-auto text-tiny text-ink-3 hover:text-ink"
      >
        Reset
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file !== undefined) void importSpec(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * The engine already knows which field is wrong — `SpecError` carries a path
 * and a message per issue. Showing only the summary threw that away and left
 * people hunting through JSON for something the error could have named.
 */
function SolveError({ error }: { error: Error }) {
  const issues = error instanceof SpecError ? error.issues : [];
  return (
    <div className="flex flex-1 items-center justify-center bg-proof p-12">
      <div className="max-w-md rounded-bench border border-reg/50 bg-card p-4">
        <p className="text-sm text-reg">This spec cannot be solved.</p>
        {issues.length > 0 ? (
          <ul className="mt-2">
            {issues.map((issue, i) => (
              <li key={i} className="mb-1 text-tiny leading-snug last:mb-0">
                {issue.path !== '' && (
                  <span className="font-mono text-micro text-mark">{issue.path} </span>
                )}
                <span className="text-ink-2">{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-tiny leading-relaxed text-ink-2">{error.message}</p>
        )}
        <p className="mt-2 text-tiny text-ink-3">
          The JSON tab shows the same errors inline against the field.
        </p>
      </div>
    </div>
  );
}
