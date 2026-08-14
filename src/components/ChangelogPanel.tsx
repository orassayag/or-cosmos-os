import { useEffect } from 'react';

import {
  DRIFT_KIND_META,
  SERVICES_BY_ID,
  TOPICS_BY_ID,
  driftCommitUrl,
  driftEntriesByRun,
  driftPrUrl,
} from '../scenarios/data';
import type { SpotlightTarget } from './Spotlight';

interface ChangelogPanelProps {
  open: boolean;
  onClose: () => void;
  /** Fly the map to a node when a changelog item's target is clicked. */
  onSelectNode: (target: SpotlightTarget) => void;
}

/** "Fri, Aug 13" run header from an ISO date, stamped in UTC. */
function runHeading(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Architecture Changelog (F6). A slide-over reading the drift history as a
 * human release log: every nightly run, its 🟢 added / 🟡 changed / 🔴 risk /
 * 📦 removed findings, each linking to the draft PR, the source commit, and
 * the affected node on the map.
 */
export function ChangelogPanel({ open, onClose, onSelectNode }: ChangelogPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runs = driftEntriesByRun();

  return (
    <div className="lc-changelog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="lc-changelog" role="dialog" aria-label="Architecture changelog">
        <header className="lc-changelog-head">
          <div>
            <div className="lc-changelog-eyebrow">Architecture changelog</div>
            <h2 className="lc-changelog-title">What Drift Sync caught</h2>
          </div>
          <button className="lc-changelog-close" onClick={onClose} aria-label="Close changelog">
            <svg width={14} height={14} viewBox="0 0 14 14">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="lc-changelog-body">
          {runs.map((run) => (
            <section key={run.date} className="lc-changelog-run">
              <div className="lc-changelog-run-date">{runHeading(run.date)}</div>
              <ul className="lc-changelog-list">
                {run.entries.map((entry) => {
                  const meta = DRIFT_KIND_META[entry.kind];
                  const prUrl = driftPrUrl(entry);
                  const commitUrl = driftCommitUrl(entry);
                  return (
                    <li key={entry.id} className="lc-changelog-item">
                      <span className="lc-changelog-glyph" aria-hidden="true">{meta.glyph}</span>
                      <div className="lc-changelog-item-body">
                        <div className="lc-changelog-item-title">{entry.title}</div>
                        <div className="lc-changelog-item-detail">{entry.detail}</div>
                        <div className="lc-changelog-item-links">
                          <span className="lc-changelog-kind" style={{ color: meta.color }}>{meta.label}</span>
                          {entry.nodeIds.map((nodeId) => {
                            const svc = SERVICES_BY_ID[nodeId];
                            const topic = TOPICS_BY_ID[nodeId];
                            const node = svc ?? topic;
                            if (!node) return null;
                            return (
                              <button
                                key={nodeId}
                                type="button"
                                className="lc-changelog-node"
                                onClick={() => onSelectNode({ id: nodeId, kind: topic ? 'topic' : 'service' })}
                                title={`Show ${node.name} on the map`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                          {prUrl && (
                            <a className="lc-changelog-link" href={prUrl} target="_blank" rel="noopener noreferrer">
                              PR #{entry.prNumber}
                            </a>
                          )}
                          {commitUrl && entry.source && (
                            <a className="lc-changelog-link" href={commitUrl} target="_blank" rel="noopener noreferrer">
                              {entry.source.repo}@{entry.source.sha}
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
