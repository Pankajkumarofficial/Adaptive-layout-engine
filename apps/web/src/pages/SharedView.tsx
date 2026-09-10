import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdSpec, LayoutResult } from '@ale/engine';
import { api, ApiError } from '../lib/api';
import { AdRenderer } from '../renderer/AdRenderer';
import { fitScale } from '../lib/presets';
import { useAppTheme } from '../lib/theme';

/**
 * A shared link, open to anyone. The server has already solved every preset, so
 * this page is the proof itself: one spec, every surface, nothing to configure.
 */
export function SharedView() {
  const { slug } = useParams<{ slug: string }>();
  const { theme, toggle } = useAppTheme();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; name: string; spec: AdSpec; results: LayoutResult[] }
  >({ status: 'loading' });

  useEffect(() => {
    if (slug === undefined) return;
    void api
      .shared(slug)
      .then((data) =>
        setState({ status: 'ready', name: data.name, spec: data.spec, results: data.results }),
      )
      .catch((err: unknown) =>
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'That link could not be opened',
        }),
      );
  }, [slug]);

  return (
    <div className="board-tooth min-h-full bg-board">
      <header className="flex items-end gap-4 border-b-2 border-ink bg-paper px-6 pb-3 pt-4">
        <h1 className="font-display text-[27px] font-bold leading-[0.92] tracking-[-0.018em]">
          {state.status === 'ready' ? state.name : 'Shared layout'}
        </h1>
        <p className="mb-1 max-w-[46ch] text-tiny leading-snug text-ink-2">
          One spec, solved for each surface by the same engine that runs in the editor.
        </p>
        <div className="mb-1 ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="border border-rule-2 px-2 py-1 text-micro text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            {theme === 'dark' ? 'Darkroom' : 'Daylight'}
          </button>
          <Link to="/" className="text-tiny text-guide hover:text-ink">
            Open the playground
          </Link>
        </div>
      </header>

      {state.status === 'loading' && <p className="p-6 text-tiny text-ink-2">Loading&hellip;</p>}

      {state.status === 'error' && (
        <div className="m-6 max-w-md border border-reg/50 bg-reg/5 p-4">
          <p className="text-sm text-reg">{state.message}</p>
          <p className="mt-1 text-tiny text-ink-2">
            The link may have been revoked, or the spec behind it deleted.
          </p>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="grid gap-6 p-6 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {state.results.map((result) => {
            // A uniform tile height keeps the grid rows aligned; a 9:16 story and
            // a 728x90 leaderboard otherwise stagger every row they share.
            const scale = fitScale(result.surface, 216, 232);
            return (
              <figure key={result.surface.id}>
                <div className="flex h-[260px] items-center justify-center bg-proof p-3">
                  <div
                    className="shadow-paste"
                    style={{
                      width: result.surface.width * scale,
                      height: result.surface.height * scale,
                    }}
                  >
                    <AdRenderer
                      spec={state.spec}
                      surface={result.surface}
                      result={result}
                      scale={scale}
                    />
                  </div>
                </div>
                <figcaption className="mt-2 border-t border-rule pt-1">
                  <span className="text-tiny font-medium">{result.surface.label}</span>
                  <span className="ml-2 text-tiny text-guide">{result.archetype}</span>
                  {result.dropped.length > 0 && (
                    <p className="text-micro text-reg">
                      dropped {result.dropped.map((d) => d.id).join(', ')}
                    </p>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
