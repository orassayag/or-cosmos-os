import { AnimatePresence, motion } from 'framer-motion';

import type { Incident } from '../scenarios/data';

interface IncidentBannerProps {
  /** The active incident, or null when a normal scenario (or nothing) plays. */
  incident: Incident | null;
}

/**
 * The "you are watching a recording" banner. Sits at the top of the stage
 * whenever an incident is the active playable, so an incident replay can
 * never be mistaken for live traffic. Purely informational — playback is
 * driven by the same controls as any scenario.
 */
export function IncidentBanner({ incident }: IncidentBannerProps) {
  return (
    <AnimatePresence>
      {incident && (
        <motion.div
          key={incident.id}
          className="lc-incident-banner"
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.24, ease: [0.2, 0.9, 0.3, 1.1] }}
        >
          <span className="lc-incident-banner-badge">INCIDENT</span>
          <span className="lc-incident-banner-text">
            <span className="lc-incident-banner-lead">
              Replaying incident from {incident.date}
              {incident.time ? ` · ${incident.time}` : ''}
            </span>
            <span className="lc-incident-banner-note">{incident.note}</span>
          </span>
          {incident.refs && incident.refs.length > 0 && (
            <span className="lc-incident-banner-refs">
              {incident.refs.map((ref) => (
                <a
                  key={ref.url}
                  className="lc-incident-banner-ref"
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ref.label}
                </a>
              ))}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
