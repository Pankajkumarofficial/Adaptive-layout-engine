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
import { JsonView } from '../components/JsonView';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Swatch } from '../components/Field';
import { Library } from '../components/Library';
import type { AdSpec } from '@ale/engine';

type LeftTab = 'elements' | 'theme' | 'json' | 'library';

export function Playground() {
  const spec = usePlayground((s) => s.spec);
  const surface = usePlayground((s) => s.surface);
  const selectedId = usePlayground((s) => s.selectedElementId);
  const [tab, setTab] = useState<LeftTab>('elements');
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
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-rule-2 bg-paper">
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

        <main className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary label="The canvas">
            {error !== null ? (
              <SolveError message={error.message} />
            ) : (
              <SurfaceCanvas result={result} />
            )}
          </ErrorBoundary>
          <ErrorBoundary label="The matrix">
            <MatrixView spec={spec} />
          </ErrorBoundary>
        </main>

        <aside className="flex w-[400px] shrink-0 flex-col border-l border-rule-2 bg-paper">
          <h2 className="border-b border-rule px-4 py-2.5 font-display text-[17px] font-medium leading-none">
            What the engine decided
          </h2>
          <ErrorBoundary label="The inspector">
            {result !== null ? (
              <Inspector result={result} ms={ms} />
            ) : (
              <p className="p-4 text-tiny text-ink-3">Nothing to show until the spec is valid.</p>
            )}
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}

function TitleBar() {
  const spec = usePlayground((s) => s.spec);
  const surface = usePlayground((s) => s.surface);
  return (
    <header className="flex items-end gap-4 border-b-2 border-ink bg-paper px-4 pb-2 pt-2.5">
      <h1 className="font-display text-[27px] font-bold leading-[0.92] tracking-[-0.018em]">
        Adaptive Layout Engine
      </h1>
      <p className="mb-px max-w-[42ch] text-tiny leading-snug text-ink-2">
        One spec, solved for each surface. Nothing here is a template &mdash; every position below
        is a decision, and the engine shows its working.
      </p>
      <dl className="mb-px ml-auto flex items-end gap-5 text-right">
        <div>
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
    </header>
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

function SolveError({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-proof p-12">
      <div className="max-w-md rounded-bench border border-reg/50 bg-card p-4">
        <p className="text-sm text-reg">This spec cannot be solved.</p>
        <p className="mt-1 tabular text-tiny leading-relaxed text-ink-2">{message}</p>
        <p className="mt-2 text-tiny text-ink-3">
          Fix it in the JSON tab; the errors there name the exact field.
        </p>
      </div>
    </div>
  );
}
