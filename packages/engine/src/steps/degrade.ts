import type { Tracer } from '../trace.js';
import type { NormalizedElement } from './normalize.js';
import type { Shortfall } from './budget.js';

export interface DropPlan {
  /** Ids to remove together. More than one only when `alwaysPairs` binds them. */
  ids: string[];
  /** Why each id in `ids` was dropped, written from that element's point of view. */
  reasons: Record<string, string>;
}

/**
 * Step 6 — pick the next thing to sacrifice.
 *
 * Highest priority number goes first, exactly as the data model promises. The
 * only subtlety is `alwaysPairs`: a bound pair is atomic, so a pair whose
 * partner is protected is itself unprotectable and gets skipped rather than
 * half-dropped.
 */
export function chooseDrop(
  active: readonly NormalizedElement[],
  shortfalls: readonly Shortfall[],
  neverDrop: ReadonlySet<string>,
  alwaysPairs: readonly [string, string][],
  tracer: Tracer,
): DropPlan | null {
  const deficitPx = shortfalls.reduce((acc, s) => acc + (s.required - s.available), 0);
  const byId = new Map(active.map((el) => [el.id, el]));

  // Most-droppable first: highest priority number, then latest in author order.
  const candidates = active
    .slice()
    .sort((a, b) => b.priority - a.priority || b.id.localeCompare(a.id));

  for (const candidate of candidates) {
    if (neverDrop.has(candidate.id)) continue;

    const group = pairClosure(candidate.id, alwaysPairs).filter((id) => byId.has(id));
    const protectedMember = group.find((id) => neverDrop.has(id));
    if (protectedMember !== undefined) {
      tracer.info(
        'degrade',
        `"${candidate.id}" is bound to protected "${protectedMember}", so it cannot be dropped`,
        { subject: candidate.id },
      );
      continue;
    }

    // Each member explains its own removal: the one that lost on priority says
    // so, and the ones that went with it name the partner that took them.
    const reasons: Record<string, string> = {};
    const recovered = `to recover ${Math.round(deficitPx)}px of unmet minimums`;
    for (const id of group) {
      const partners = group.filter((other) => other !== id);
      const self = byId.get(id);
      const priority = self?.priority ?? candidate.priority;
      reasons[id] =
        partners.length > 0
          ? `priority ${priority}; bound to ${partners.join(', ')}, dropped together ${recovered}`
          : `priority ${priority}; dropped ${recovered}`;
    }

    tracer.decision(
      'degrade',
      `dropping ${group.join(' + ')} — priority ${candidate.priority} ${recovered}`,
      {
        subject: candidate.id,
        data: {
          priority: candidate.priority,
          deficitPx: Math.round(deficitPx),
          group: group.length,
        },
      },
    );

    return { ids: group, reasons };
  }

  tracer.warn('degrade', 'nothing left to drop; only protected elements remain');
  return null;
}

/** Transitive closure of `alwaysPairs` over one id. Deterministically ordered. */
export function pairClosure(id: string, pairs: readonly [string, string][]): string[] {
  const group = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [a, b] of pairs) {
      if (group.has(a) && !group.has(b)) {
        group.add(b);
        grew = true;
      }
      if (group.has(b) && !group.has(a)) {
        group.add(a);
        grew = true;
      }
    }
  }
  return [...group].sort();
}
