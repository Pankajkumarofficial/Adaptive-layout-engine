import { useEffect, useState } from 'react';
import { adSpecSchema } from '@ale/shared';
import type { AdSpec } from '@ale/engine';
import { usePlayground } from '../lib/store';

interface Issue {
  path: string;
  message: string;
}

/**
 * Raw spec editing with the same zod schema the engine and the API use, so an
 * error here is the error you would get from the server, worded identically.
 */
export function JsonView() {
  const spec = usePlayground((s) => s.spec);
  const setSpec = usePlayground((s) => s.setSpec);
  const [draft, setDraft] = useState(() => JSON.stringify(spec, null, 2));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dirty, setDirty] = useState(false);

  // Re-sync when the spec changes underneath us, but never while the user is
  // mid-edit: clobbering their text would be worse than showing a stale copy.
  useEffect(() => {
    if (!dirty) setDraft(JSON.stringify(spec, null, 2));
  }, [spec, dirty]);

  const validate = (text: string): Issue[] => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return [{ path: '', message: err instanceof Error ? err.message : 'invalid JSON' }];
    }
    const result = adSpecSchema.safeParse(parsed);
    if (result.success) return [];
    return result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  };

  const apply = () => {
    const found = validate(draft);
    setIssues(found);
    if (found.length === 0) {
      setSpec(JSON.parse(draft) as AdSpec);
      setDirty(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <textarea
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
          setIssues(validate(e.target.value));
        }}
        className="min-h-0 flex-1 resize-none bg-card p-3 font-mono text-tiny leading-relaxed text-ink focus:outline-none"
        aria-label="Spec as JSON"
      />
      <div className="border-t border-rule">
        {issues.length > 0 ? (
          <ul className="max-h-32 overflow-auto px-3 py-2">
            {issues.map((issue, i) => (
              <li key={i} className="font-mono text-micro leading-relaxed text-reg">
                {issue.path !== '' && <span className="text-mark">{issue.path} </span>}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-tiny text-ink-3">
            {dirty ? 'Valid. Apply to solve it.' : 'Matches the current spec.'}
          </p>
        )}
        <div className="flex gap-2 border-t border-rule px-3 py-2">
          <button
            type="button"
            onClick={apply}
            disabled={issues.length > 0 || !dirty}
            className="rounded-bench bg-guide px-2 py-1 text-tiny text-on-accent disabled:bg-rule disabled:text-ink-3"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(JSON.stringify(spec, null, 2));
              setIssues([]);
              setDirty(false);
            }}
            className="rounded-bench border border-rule px-2 py-1 text-tiny text-ink-2 hover:border-guide hover:text-ink"
          >
            Revert
          </button>
        </div>
      </div>
    </div>
  );
}
