import type { DriftEntry } from '../scenarios/drift';
import { DRIFT_KIND_META, driftPrUrl } from '../scenarios/drift';

interface DriftOverlayProps {
  /** Entries from the most recent nightly run. */
  entries: DriftEntry[];
  /** ISO date of that run (already known non-null by the caller). */
  date: string;
  /** Jump the map to (and select) the entry's primary node. */
  onFocus: (nodeId: string) => void;
}

/** Human "Aug 13" from an ISO date, in UTC to match the run stamp. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The "What changed last night" legend (F5). Lists the latest run's drift
 * findings; clicking one flies the map to the affected node, and the PR
 * link opens the draft the pipeline raised. The nodes themselves glow on
 * the map in each finding's kind color while this overlay is active.
 */
export function DriftOverlay({ entries, date, onFocus }: DriftOverlayProps) {
  return (
    <div className="lc-drift-overlay" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      <div className="lc-drift-overlay-title">Changed · {shortDate(date)}</div>
      <div className="lc-drift-overlay-hint">
        {entries.length} finding{entries.length === 1 ? '' : 's'} — click to fly there
      </div>
      <ul className="lc-drift-overlay-list">
        {entries.map((entry) => {
          const meta = DRIFT_KIND_META[entry.kind];
          const prUrl = driftPrUrl(entry);
          return (
            <li key={entry.id}>
              <button
                type="button"
                className="lc-drift-overlay-item"
                onClick={() => onFocus(entry.nodeIds[0])}
                title={entry.detail}
              >
                <span
                  className="lc-drift-overlay-swatch"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <span className="lc-drift-overlay-label">{entry.title}</span>
              </button>
              {prUrl && (
                <a
                  className="lc-drift-overlay-pr"
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open draft PR #${entry.prNumber}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  #{entry.prNumber}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
