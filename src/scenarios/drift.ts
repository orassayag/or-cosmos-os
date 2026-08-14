/**
 * Drift history — the honesty loop, made visible.
 *
 * Each entry is one change the nightly Drift Sync pipeline caught: a topic
 * added, a route removed, a payload that drifted from the map. The shape
 * mirrors the pipeline's own verdict schema (see
 * `drift-sync/scripts/diff-repo.ts` — `kind`, `evidence`, `confidence`) so a
 * real run could later emit this file directly instead of the fictional
 * AstroMart data below.
 *
 * Two features read this:
 *   • F5 — the "What changed last night" map overlay (glows `nodeIds`).
 *   • F6 — the Architecture Changelog panel (lists every entry by run).
 */
import { BRAND } from './brand';
import type { Service } from './types';

/** Coarse changelog bucket. Maps 1:1 to the 🟢/🟡/🔴/📦 changelog markers. */
export type DriftKind = 'added' | 'changed' | 'risk' | 'removed';

export interface DriftEntry {
  /** Stable id — also the changelog row key. */
  id: string;
  /** ISO date (YYYY-MM-DD) of the nightly run that caught this. */
  date: string;
  kind: DriftKind;
  /** Short human title, e.g. "New topic: shipping.dispatched". */
  title: string;
  /** One-line plain-English description for the changelog row. */
  detail: string;
  /** Owning team, when the drift belongs to one. */
  team?: Service['team'];
  /**
   * Service / topic ids this change touches — must match `SERVICES[].id` or
   * `TOPICS[].id`. Drives the F5 glow and the click-to-jump target.
   */
  nodeIds: string[];
  /** file:line evidence quotes, exactly as the pipeline records them. */
  evidence?: string[];
  /** Draft PR the pipeline opened on the Cosmos repo for this run's team. */
  prNumber?: number;
  /** Source repo + short SHA the drift was detected in (→ commit link). */
  source?: { repo: string; sha: string };
  confidence?: 'high' | 'medium' | 'low';
}

/** Base URL of the Cosmos repo, derived from the Drift Sync workflow link. */
const COSMOS_REPO_URL = BRAND.driftSyncUrl.replace(/\/actions\/.*$/, '');

/** Link to the draft PR the pipeline opened for an entry, if any. */
export function driftPrUrl(entry: DriftEntry): string | null {
  return entry.prNumber == null ? null : `${COSMOS_REPO_URL}/pull/${entry.prNumber}`;
}

/** Link to the source-repo commit the drift was detected in, if any. */
export function driftCommitUrl(entry: DriftEntry): string | null {
  return entry.source == null
    ? null
    : `${BRAND.repoBaseUrl}/${entry.source.repo}/commit/${entry.source.sha}`;
}

/** Presentation metadata per drift kind — color token, hex, and marker. */
export const DRIFT_KIND_META: Record<
  DriftKind,
  { label: string; color: string; hex: string; glyph: string }
> = {
  added:   { label: 'Added',   color: 'var(--svc-green)', hex: '#5FD08A', glyph: '🟢' },
  changed: { label: 'Changed', color: 'var(--svc-amber)', hex: '#E6C34A', glyph: '🟡' },
  risk:    { label: 'Risk',    color: 'var(--svc-red)',   hex: '#E8654A', glyph: '🔴' },
  removed: { label: 'Removed', color: 'var(--text-dim)',  hex: '#7A8088', glyph: '📦' },
};

/**
 * Fictional AstroMart drift history — newest run first. Kept fictional per
 * the project's demo-data rule; node ids are all real map nodes so the
 * overlay and jump-to-node work end to end.
 */
export const DRIFT_ENTRIES: DriftEntry[] = [
  {
    id: 'd-2026-08-13-shipping-dispatched',
    date: '2026-08-13',
    kind: 'added',
    title: 'New topic: shipping.dispatched',
    detail:
      'Shipping now publishes a dispatched event when a parcel leaves the depot; Notifications subscribes to it.',
    team: 'team-fulfillment',
    nodeIds: ['shipping', 'shipping.dispatched', 'notifications'],
    evidence: [
      'shipping/src/dispatch/publisher.ts:44 — producer.send({ topic: "shipping.dispatched" })',
      'notifications/src/handlers/dispatched.ts:12 — new consumer group "notif-dispatched"',
    ],
    prNumber: 128,
    source: { repo: 'shipping', sha: 'a1b2c3d' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-13-orders-payload',
    date: '2026-08-13',
    kind: 'changed',
    title: 'orders.created payload gained `giftWrap`',
    detail:
      'The Orders event now carries a giftWrap flag. The map step payload was stale.',
    team: 'team-fulfillment',
    nodeIds: ['orders', 'orders.created'],
    evidence: [
      'orders/src/events/orderCreated.schema.ts:31 — giftWrap: z.boolean().default(false)',
    ],
    prNumber: 128,
    source: { repo: 'orders', sha: 'e4f5a6b' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-13-catalog-search',
    date: '2026-08-13',
    kind: 'risk',
    title: 'Search reads Catalog’s Postgres directly',
    detail:
      'Search added a direct DB read against Catalog’s tables, bypassing the API — a coupling the map doesn’t model.',
    team: 'team-shopping',
    nodeIds: ['search', 'catalog'],
    evidence: [
      'search/src/index/backfill.ts:88 — new Pool({ host: "catalog-db.internal" })',
    ],
    prNumber: 129,
    source: { repo: 'search', sha: '7c8d9e0' },
    confidence: 'medium',
  },
  {
    id: 'd-2026-08-06-back-in-stock',
    date: '2026-08-06',
    kind: 'added',
    title: 'New topic: inventory.back-in-stock',
    detail:
      'Inventory now emits a back-in-stock event; Notifications fans out restock alerts.',
    team: 'team-fulfillment',
    nodeIds: ['inventory', 'inventory.back-in-stock', 'notifications'],
    evidence: [
      'inventory/src/restock/emitter.ts:52 — topic: "inventory.back-in-stock"',
    ],
    prNumber: 121,
    source: { repo: 'inventory', sha: '3f2a1b0' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-06-cart-legacy-route',
    date: '2026-08-06',
    kind: 'removed',
    title: 'Removed legacy Cart → Payments route',
    detail:
      'Cart no longer calls Payments directly for quick-buy; the flow goes through Orders now. The old edge is dead.',
    team: 'team-shopping',
    nodeIds: ['cart', 'payments'],
    evidence: [
      'cart/src/quickbuy/index.ts:— deleted paymentsClient.authorize() call',
    ],
    prNumber: 122,
    source: { repo: 'cart', sha: 'b9c8d7e' },
    confidence: 'high',
  },
];

/** The most recent run's date, or null when there is no history. */
export const LATEST_DRIFT_DATE: string | null =
  DRIFT_ENTRIES.length > 0
    ? DRIFT_ENTRIES.reduce((max, e) => (e.date > max ? e.date : max), DRIFT_ENTRIES[0].date)
    : null;

/** Entries from the most recent run — what F5 glows as "changed last night". */
export const LATEST_DRIFT_ENTRIES: DriftEntry[] = DRIFT_ENTRIES.filter(
  (e) => e.date === LATEST_DRIFT_DATE,
);

/**
 * node id → drift kind for the latest run. When a node appears in several
 * entries, the highest-severity kind wins (risk > removed > changed > added)
 * so the overlay reflects the most important thing that happened to it.
 */
const KIND_SEVERITY: Record<DriftKind, number> = { risk: 3, removed: 2, changed: 1, added: 0 };

export const LATEST_DRIFT_BY_NODE: Map<string, DriftKind> = (() => {
  const map = new Map<string, DriftKind>();
  for (const entry of LATEST_DRIFT_ENTRIES) {
    for (const nodeId of entry.nodeIds) {
      const existing = map.get(nodeId);
      if (existing == null || KIND_SEVERITY[entry.kind] > KIND_SEVERITY[existing]) {
        map.set(nodeId, entry.kind);
      }
    }
  }
  return map;
})();

/** Drift entries grouped by run date, newest run first — for the changelog. */
export function driftEntriesByRun(): { date: string; entries: DriftEntry[] }[] {
  const byDate = new Map<string, DriftEntry[]>();
  for (const entry of DRIFT_ENTRIES) {
    const bucket = byDate.get(entry.date) ?? [];
    bucket.push(entry);
    byDate.set(entry.date, bucket);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([date, entries]) => ({ date, entries }));
}
