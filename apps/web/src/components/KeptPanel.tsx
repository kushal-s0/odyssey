import { Suspense, useState, type ReactNode } from 'react'

/** Mount on first visit and preserve in-memory UI until this account workspace unmounts. */
export function KeptPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  return <div hidden={!active}>{(active || visited) && <Suspense fallback={<p role="status">Opening workspace…</p>}>{children}</Suspense>}</div>
}
