/**
 * What sits under the cursor.
 *
 * Deliberately a union rather than a bare index: not every view has a term
 * under the pointer. A histogram bar identifies a *set* of terms and an
 * autocorrelation bar identifies a *lag*, so forcing either to return an
 * index would make it answer falsely — which is exactly the class of quiet
 * wrongness this project keeps having to design out.
 */
export type Hit =
  | { kind: 'term'; index: number }
  | { kind: 'digit'; index: number; digitPos: number }
  | { kind: 'bin'; binIndex: number; lo: number; hi: number; count: number }
  | { kind: 'lag'; lag: number };

/** The term index a hit refers to, when it refers to one at all. */
export function hitIndex(hit: Hit | null): number | null {
  if (!hit) return null;
  return hit.kind === 'term' || hit.kind === 'digit' ? hit.index : null;
}
