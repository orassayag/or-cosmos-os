import { useCallback, useEffect, useMemo, useState } from 'react';

import { CosmosMap } from './map/Map';
import { DomainBar } from './components/DomainBar';
import { ScenarioStatus } from './components/ScenarioStatus';
import { PlaybackControls } from './components/PlaybackControls';
import { StepPanel } from './components/StepPanel';
import { ActivityLog } from './components/ActivityLog';
import { IntroOverlay } from './components/IntroOverlay';
import { WarpTransition } from './components/WarpTransition';
import { HelpButton } from './components/HelpButton';
import { DriftFooter } from './components/DriftFooter';
import { AskAgent } from './components/AskAgent';
import { AskPanel } from './components/AskPanel';
import { ChangelogPanel } from './components/ChangelogPanel';
import type { ChangelogActivation, CosmosState } from './components/ChangelogPanel';
import { Spotlight } from './components/Spotlight';
import type { SpotlightTarget } from './components/Spotlight';
import { BrandStarfield } from './map/BrandStarfield';
import { OverlayProvider, useOverlay, useOverlayManager, OVERLAY } from './overlays/OverlayManager';

import { DOMAINS, SCENARIOS_BY_ID, SERVICES } from './scenarios/data';
import type { Step } from './scenarios/types';
import { useScenarioRunner } from './scenarios/runner';
import type { Shot } from './scenarios/runner';
import { readInitialDeepLink, useDeepLink } from './hooks/useDeepLink';
import { BRAND } from './scenarios/brand';

interface ActivityEntry { idx: number; step: Step }

export function App() {
  const initial = useMemo(readInitialDeepLink, []);
  const [showIntro, setShowIntro] = useState(
    () => initial.scenario == null && initial.domain == null && !localStorage.getItem('cosmos-intro-seen'),
  );
  // Plays the hyperspace warp between the intro CTA and the cosmos shell.
  const [warping, setWarping] = useState(false);
  const [activeDomain, setActiveDomain] = useState(() => initial.domain ?? DOMAINS[0].id);

  const runner = useScenarioRunner();
  const { state, steps, scenario, setScenario, jumpTo, completeCurrentShot, onShot } = runner;

  // Hydrate from deep link on first paint.
  useEffect(() => {
    if (initial.scenario && SCENARIOS_BY_ID[initial.scenario]) {
      setScenario(initial.scenario);
      if (initial.step != null) {
        // Defer so steps array is populated.
        queueMicrotask(() => jumpTo(initial.step!));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push UI state into the URL.
  useDeepLink({
    domain: activeDomain,
    scenario: state.scenarioId,
    step: state.idx >= 0 ? state.idx : null,
  });

  // Latest shot from the runner — drives the comet animation in Map.
  const [shot, setShot] = useState<Shot | null>(null);
  const [history, setHistory] = useState<ActivityEntry[]>([]);
  const [spotlightTarget, setSpotlightTarget] = useState<SpotlightTarget | null>(null);
  // The step explainer panel can be dismissed by the user; it auto-reopens
  // whenever the user navigates (next/prev/dot/play) or picks a new scenario.
  const [panelOpen, setPanelOpen] = useState(true);

  // Single-slot manager so no modal/overlay ever overrides another.
  const overlay = useOverlayManager();
  // A changelog item warps to its affected node: play the hyperspace effect,
  // then land the map on the node once the warp finishes.
  const [warp, setWarp] = useState<ChangelogActivation | null>(null);
  // The commit/branch the map is currently framed on (set after a warp), shown
  // beside the title so you always know which state you're looking at.
  const [cosmosState, setCosmosState] = useState<CosmosState | null>(null);
  // Bumped by the "Cosmos" title to force the map back to its initial state.
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    return onShot((s) => {
      setShot(s);
      // Append every step in the shot to the activity log (keep them in order).
      setHistory((h) => {
        const baseIdx = s.startIdx;
        const additions = s.steps.map((step, i) => ({ idx: baseIdx + i, step }));
        // Avoid duplicates if the same shot fires twice (e.g. user clicks Next mid-play).
        const lastIdx = h.length > 0 ? h[h.length - 1].idx : -1;
        const filtered = additions.filter((a) => a.idx > lastIdx);
        return [...h, ...filtered];
      });
    });
  }, [onShot]);

  const handleShotComplete = useCallback(
    (token: number) => {
      // Ignore late callbacks from invalidated shots.
      if (shot && token !== shot.token) return;
      completeCurrentShot();
    },
    [shot, completeCurrentShot],
  );

  const handlePickScenario = useCallback(
    (scenarioId: string) => {
      setScenario(scenarioId);
      setHistory([]);
      setShot(null);
      setPanelOpen(true);
    },
    [setScenario],
  );

  // Wrap navigation actions so they reopen the explainer panel if it
  // was dismissed. The user clicking a dot / next / prev / play is a
  // strong signal they want to see the description again.
  const navPrev    = useCallback(() => { setPanelOpen(true); runner.prev(); }, [runner]);
  const navNext    = useCallback(() => { setPanelOpen(true); runner.next(); }, [runner]);
  const navJump    = useCallback((i: number) => { setPanelOpen(true); runner.jumpTo(i); }, [runner]);
  const navPlay    = useCallback(() => { setPanelOpen(true); runner.play(); }, [runner]);
  // Restart: rewind to step 0 and play. Also clears the activity log so
  // it doesn't show entries from the last run.
  const navRestart = useCallback(() => {
    setPanelOpen(true);
    setHistory([]);
    setShot(null);
    runner.jumpTo(0);
    // jumpTo flips state to non-playing; defer play so the index update
    // is committed before play() reads it.
    queueMicrotask(() => runner.play());
  }, [runner]);

  const handlePickDomain = useCallback(
    (domainId: string) => {
      // Browsing other domains shouldn't kill the active scenario —
      // it stays running / framed until the user explicitly picks a
      // different scenario from the dropdown (or hits ESC).
      setActiveDomain(domainId);
    },
    [],
  );

  // A whole changelog item was clicked: close the changelog and kick off the
  // hyperspace warp toward the item's affected node.
  const handleActivateChangelogItem = useCallback(
    (activation: ChangelogActivation) => {
      overlay.close(OVERLAY.changelog);
      setWarp(activation);
    },
    [overlay],
  );

  // Warp finished — land the map on the node the item pointed at and record
  // the commit/branch it represents so the title can show where we are.
  const handleWarpDone = useCallback(() => {
    if (warp) {
      setSpotlightTarget(warp.target);
      setCosmosState(warp.state);
    }
    setWarp(null);
  }, [warp]);

  // The "Cosmos" title resets the galaxy to its initial state: no scenario,
  // home domain, cleared history/URL params, every overlay closed, map reframed.
  const handleResetGalaxy = useCallback(() => {
    setScenario(null);
    setHistory([]);
    setShot(null);
    setPanelOpen(true);
    setActiveDomain(DOMAINS[0].id);
    setSpotlightTarget(null);
    setWarp(null);
    setCosmosState(null);
    overlay.reset();
    setResetNonce((n) => n + 1);
  }, [setScenario, overlay]);

  // ESC resets the whole galaxy — clears the scenario, filters, selection,
  // overlays and URL, and reframes the map to home. Skipped while a modal
  // (help / changelog / spotlight) is open, since each closes on its own Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.target && (e.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) return;
      if (document.querySelector('.lc-help-overlay, .lc-changelog-backdrop, .lc-spotlight-backdrop')) return;
      handleResetGalaxy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleResetGalaxy]);

  // Any active scenario isolates the map — the moment a scenario is
  // picked, fade everything outside its touch set so the active flow
  // is the only thing the eye lands on.
  const isolate = !!state.scenarioId;

  // Map is mounted ONLY after the intro CTA fires — otherwise the canvas
  // briefly paints behind the overlay on first render.
  // The warp can run UNDER the intro while it fades — so the user
  // sees hyperspace ignite first and the intro dissolves to reveal it.
  if (showIntro || warping) {
    return (
      <>
        {warping && <WarpTransition onDone={() => setWarping(false)} />}
        {showIntro && (
          <IntroOverlay
            onStart={() => {
              localStorage.setItem('cosmos-intro-seen', '1');
              setWarping(true);
            }}
            onExitComplete={() => setShowIntro(false)}
          />
        )}
      </>
    );
  }

  return (
    <OverlayProvider value={overlay}>
      <CosmosShell
        activeDomain={activeDomain}
        runner={runner}
        state={state}
        steps={steps}
        scenario={scenario}
        shot={shot}
        history={history}
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        handlePickDomain={handlePickDomain}
        handlePickScenario={handlePickScenario}
        handleShotComplete={handleShotComplete}
        isolate={isolate}
        setHistory={setHistory}
        navPlay={navPlay}
        navPrev={navPrev}
        navNext={navNext}
        navJump={navJump}
        navRestart={navRestart}
        spotlightTarget={spotlightTarget}
        setSpotlightTarget={setSpotlightTarget}
        warping={!!warp}
        onWarpDone={handleWarpDone}
        onActivateChangelogItem={handleActivateChangelogItem}
        onResetGalaxy={handleResetGalaxy}
        cosmosState={cosmosState}
        resetNonce={resetNonce}
      />
    </OverlayProvider>
  );
}

interface CosmosShellProps {
  activeDomain: string;
  runner: ReturnType<typeof useScenarioRunner>;
  state: ReturnType<typeof useScenarioRunner>['state'];
  steps: Step[];
  scenario: ReturnType<typeof useScenarioRunner>['scenario'];
  shot: Shot | null;
  history: ActivityEntry[];
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  handlePickDomain: (d: string) => void;
  handlePickScenario: (s: string) => void;
  handleShotComplete: (token: number) => void;
  isolate: boolean;
  setHistory: (v: ActivityEntry[]) => void;
  navPlay: () => void;
  navPrev: () => void;
  navNext: () => void;
  navJump: (i: number) => void;
  navRestart: () => void;
  spotlightTarget: SpotlightTarget | null;
  setSpotlightTarget: (t: SpotlightTarget | null) => void;
  warping: boolean;
  onWarpDone: () => void;
  onActivateChangelogItem: (activation: ChangelogActivation) => void;
  onResetGalaxy: () => void;
  cosmosState: CosmosState | null;
  resetNonce: number;
}

function CosmosShell(p: CosmosShellProps) {
  // The first ~2.6s after the CTA we run the "ignite" sequence.
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setRevealing(false), 2600);
    return () => window.clearTimeout(t);
  }, []);

  const {
    activeDomain, runner, state, steps, scenario, shot, history,
    panelOpen, setPanelOpen, handlePickDomain, handlePickScenario,
    handleShotComplete, isolate, setHistory, navPlay, navPrev, navNext, navJump, navRestart,
    spotlightTarget, setSpotlightTarget,
    warping, onWarpDone, onActivateChangelogItem, onResetGalaxy, cosmosState, resetNonce,
  } = p;

  // Presentation mode: hide the chrome and fatten the comets for talks.
  const [presentation, setPresentation] = useState(false);

  // Every mutually-exclusive surface (changelog + the map overlays) flows
  // through this single-slot manager so none can override another.
  const overlay = useOverlay();

  // The "Ask the agent" demo: the current question drives the answer panel;
  // the nonce forces a fresh panel (new thinking + typing) on a repeat ask.
  // The panel is a managed overlay so it can never stack with the star
  // inspector or any other surface — opening one closes the rest.
  const [askQuestion, setAskQuestion] = useState<string | null>(null);
  const [askNonce, setAskNonce] = useState(0);
  // A random node the map "focuses" on while the answer shows — picked fresh
  // per question so the demo lands on a different cluster each time. The focus
  // only engages once the answer starts typing (not during "thinking").
  const [askFocusId, setAskFocusId] = useState<string | null>(null);
  const [askAnswering, setAskAnswering] = useState(false);
  const handleAsk = useCallback((question: string) => {
    setAskQuestion(question);
    setAskNonce((n) => n + 1);
    setAskFocusId(SERVICES[Math.floor(Math.random() * SERVICES.length)].id);
    setAskAnswering(false);
    overlay.open(OVERLAY.ask);
  }, [overlay]);
  const handleAnswerStart = useCallback(() => setAskAnswering(true), []);

  // Keyboard: P toggles presentation; arrows / space drive playback so the
  // deck is navigable once the on-screen controls are hidden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'p' || e.key === 'P') { setPresentation((v) => !v); return; }
      if (!state.scenarioId) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); navNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navPrev(); }
      else if (e.key === ' ') {
        e.preventDefault();
        if (state.playing) runner.pause();
        else navPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.scenarioId, state.playing, navNext, navPrev, navPlay, runner]);

  return (
    <div
      className="lc-app"
      data-revealing={revealing ? 'true' : 'false'}
      data-presentation={presentation ? 'true' : 'false'}
    >
      {/* Always-on sparkle starfield — sits behind everything. */}
      <div className="lc-app-bg" aria-hidden="true">
        <BrandStarfield density={0.1} speed={1.2} shootingEvery={60} />
      </div>

      {/* Brief radial flash that washes the scene during the reveal. */}
      {revealing && <div className="lc-reveal-flash" aria-hidden="true" />}

      <header className="lc-topbar">
        <div className="lc-topbar-row">
          <div className="lc-topbar-side lc-topbar-side--left">
            <button
              type="button"
              className="lc-topbar-brand lc-topbar-brand--reset"
              onClick={onResetGalaxy}
              title="Reset the galaxy — clear the current scenario, filters and URL"
            >
              Cosmos
              <span
                style={{
                  marginLeft: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62em',
                  letterSpacing: '0.18em',
                  opacity: 0.55,
                  textTransform: 'uppercase',
                }}
              >
                {BRAND.badge}
              </span>
            </button>
            {cosmosState && (
              <span
                className="lc-cosmos-state"
                title={`Viewing ${cosmosState.title} — ${cosmosState.repo}@${cosmosState.sha} on ${cosmosState.branch}`}
              >
                <svg className="lc-cosmos-state-icon" width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 1.5 v9 M3 4 a2.5 2.5 0 0 0 2.5 2.5 h1.5 M9 1.5 a1.5 1.5 0 1 1 0 3 a1.5 1.5 0 0 1 0 -3 Z M3 1.5 a1.5 1.5 0 1 1 0 0.01 Z M3 10.5 a1.5 1.5 0 1 1 0 0.01 Z"
                    fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="lc-cosmos-state-branch">{cosmosState.branch}</span>
                <span className="lc-cosmos-state-sep">·</span>
                <span className="lc-cosmos-state-sha">{cosmosState.repo}@{cosmosState.sha}</span>
              </span>
            )}
            <DomainBar
              active={activeDomain}
              activeScenarioId={state.scenarioId}
              onPickDomain={handlePickDomain}
              onPickScenario={handlePickScenario}
            />
          </div>

          <div className="lc-topbar-center">
            <ScenarioStatus domainId={activeDomain} activeScenarioId={state.scenarioId} />
          </div>

          <div className="lc-topbar-side lc-topbar-side--right">
            <AskAgent onAsk={handleAsk} resetNonce={resetNonce} />
            <DriftFooter />
            <button
              type="button"
              className="lc-present-btn"
              onClick={() => overlay.open(OVERLAY.changelog)}
              title="Architecture changelog — what Drift Sync has caught"
            >
              Changelog
            </button>
            <button
              type="button"
              className="lc-present-btn"
              onClick={() => setPresentation(true)}
              title="Presentation mode — hide chrome for talks (P)"
            >
              Present
            </button>
            <HelpButton />
          </div>
        </div>
      </header>

      <div className="lc-stage">
        <CosmosMap
          activeScenarioId={state.scenarioId}
          shot={shot}
          speed={state.speed}
          onShotComplete={handleShotComplete}
          isolate={isolate}
          revealing={revealing}
          presentation={presentation}
          spotlightTarget={spotlightTarget}
          onSpotlightConsumed={() => setSpotlightTarget(null)}
          resetNonce={resetNonce}
          askFocusId={askAnswering ? askFocusId : null}
        />

        <StepPanel
          scenario={scenario}
          steps={steps}
          idx={state.idx}
          open={panelOpen}
          onPrev={navPrev}
          onNext={navNext}
          onClose={() => setPanelOpen(false)}
        />

        <ActivityLog
          history={history}
          visible={!!scenario && history.length > 0}
          onClear={() => setHistory([])}
        />

        {overlay.isOpen(OVERLAY.ask) && askQuestion !== null && (
          <AskPanel
            key={askNonce}
            question={askQuestion}
            onClose={() => overlay.close(OVERLAY.ask)}
            onAnswerStart={handleAnswerStart}
          />
        )}

        <PlaybackControls
          runner={runner}
          steps={steps}
          onPlay={navPlay}
          onPrev={navPrev}
          onNext={navNext}
          onJump={navJump}
          onRestart={navRestart}
        />

      </div>

      <footer className="lc-footer">
        <button
          type="button"
          className="lc-footer-reset"
          onClick={onResetGalaxy}
          title="Reset the galaxy — clear the current scenario, filters and URL"
        >
          <kbd>Esc</kbd>
          <span>Reset</span>
        </button>
        <span className="lc-footer-hint"><kbd>P</kbd> Present</span>
        <span className="lc-footer-hint"><kbd>←</kbd> <kbd>→</kbd> Steps</span>
        <span className="lc-footer-hint"><kbd>Space</kbd> Play / Pause</span>
      </footer>

      <Spotlight
        onSelectScenario={handlePickScenario}
        onSelectNode={setSpotlightTarget}
      />

      <ChangelogPanel
        open={overlay.isOpen(OVERLAY.changelog)}
        onClose={() => overlay.close(OVERLAY.changelog)}
        onSelectNode={(target) => { setSpotlightTarget(target); overlay.close(OVERLAY.changelog); }}
        onActivateItem={onActivateChangelogItem}
      />

      {/* Hyperspace warp played when a changelog item is clicked — lands on
          the item's node once it finishes. */}
      {warping && <WarpTransition duration={1600} onDone={onWarpDone} />}

      {presentation && (
        <button
          type="button"
          className="lc-present-hint"
          onClick={() => setPresentation(false)}
          title="Exit presentation mode"
        >
          Presenting · <kbd>P</kbd> to exit · <kbd>←</kbd> <kbd>→</kbd> steps
        </button>
      )}
    </div>
  );
}
