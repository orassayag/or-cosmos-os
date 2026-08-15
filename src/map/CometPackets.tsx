import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

import type { Shot } from '../scenarios/runner';
import { PROTO_COLOR } from './Edge';
import { useEdgeRegistry } from './edge-registry';
import { legsForStep } from './edge-resolver';
import type { EdgeLeg } from './edge-resolver';
import type { Protocol } from '../scenarios/types';

gsap.registerPlugin(MotionPathPlugin);

interface CometPacketsProps {
  /** Most recent shot from the runner. New shot ⇒ comet plays. */
  shot: Shot | null;
  /** Playback rate from the runner — applied to GSAP timeline. */
  speed: number;
  /** Called when the comet timeline finishes (so the runner can advance). */
  onShotComplete: (token: number) => void;
  /**
   * Set of service ids whose ecosystems are currently expanded — when
   * a step routes through one of these, the packet traverses the
   * service's sub-services instead of just the service itself.
   */
  expanded?: Set<string> | null;
  /** Multiplier on comet radii — presentation mode fattens the packets. */
  cometScale?: number;
  /** Overrides the per-protocol comet colour when set (e.g. incident replays
   *  fly a warning-red comet instead of the wire colour). */
  tint?: string | null;
}

interface FlightHandles {
  group: SVGGElement;
  tail: SVGCircleElement;
  glow: SVGCircleElement;
  head: SVGCircleElement;
}

/**
 * Per-step duration (seconds at speed 1). Slightly different by
 * protocol so kafka feels like it travels and internal feels punchy.
 * 1× is intentionally on the slow side — viewers need time to read
 * the panel as the packet flies. 2× returns to "snappy".
 */
const PROTO_DURATION: Record<Protocol, number> = {
  internal: 0.9,
  ws: 1.4,
  http: 1.55,
  kafka: 1.7,
};

/**
 * Renders the comets for the current shot. Sits inside the SVG, in
 * front of nodes. Receives one shot at a time and animates it on
 * the rendered edge paths via GSAP MotionPathPlugin.
 */
export function CometPackets({ shot, speed, onShotComplete, expanded, cometScale = 1, tint = null }: CometPacketsProps) {
  const registry = useEdgeRegistry();
  const layerRef = useRef<SVGGElement>(null);
  const flightsRef = useRef<FlightHandles[]>([]);
  const stardustRef = useRef<SVGElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // We track the current shot via a key so layoutEffect re-runs when it changes.
  const [renderedShot, setRenderedShot] = useState<Shot | null>(null);
  useEffect(() => setRenderedShot(shot), [shot]);

  useLayoutEffect(() => {
    // Tear down previous timeline + DOM circles every shot — we recreate cleanly.
    tlRef.current?.kill();
    tlRef.current = null;
    flightsRef.current.forEach((f) => f.group.remove());
    flightsRef.current = [];
    stardustRef.current.forEach((s) => s.remove());
    stardustRef.current = [];

    if (!renderedShot || !layerRef.current) return;

    // Each step in a parallel group becomes its own timeline branch.
    // Within a step, the legs (1, 2, or 3) play sequentially.
    const tl = gsap.timeline({
      onComplete: () => onShotComplete(renderedShot.token),
    });
    tl.timeScale(speed);

    for (const step of renderedShot.steps) {
      const legs = legsForStep(step, expanded);
      if (legs.length === 0) continue;

      // Chain legs sequentially within this step's branch — but the branch
      // for each step starts at t=0 of the timeline (parallel steps fire together).
      let cursor = 0;
      for (const leg of legs) {
        const handles = createFlight(layerRef.current, leg, cometScale, tint);
        if (!handles) continue;
        flightsRef.current.push(handles);

        const path = registry.get(leg.key);
        if (!path) continue;

        const color = tint ?? PROTO_COLOR[leg.proto];
        const dur = PROTO_DURATION[leg.proto];
        const fadeIn = dur * 0.15;
        const fadeOutAt = dur * 0.85;

        // Fade in over the first 15% of the leg so the comet is invisible
        // while sitting at the starting node, only becoming visible once
        // it has already moved away from the service capsule.
        tl.fromTo(
          handles.group,
          { opacity: 0 },
          { opacity: 1, duration: fadeIn, ease: 'none' },
          cursor,
        );

        // Bright head, mid glow, soft tail — all on the same path,
        // slightly offset in time for the comet trail look.
        tl.fromTo(
          handles.head,
          { motionPath: { path, start: 0, end: 0 } },
          {
            motionPath: { path, start: 0, end: 1, autoRotate: false },
            duration: dur,
            ease: 'none',
          },
          cursor,
        );
        tl.fromTo(
          handles.glow,
          { motionPath: { path, start: 0, end: 0 } },
          {
            motionPath: { path, start: 0, end: 1, autoRotate: false },
            duration: dur,
            ease: 'none',
          },
          cursor + 0.04,
        );
        tl.fromTo(
          handles.tail,
          { motionPath: { path, start: 0, end: 0 } },
          {
            motionPath: { path, start: 0, end: 1, autoRotate: false },
            duration: dur,
            ease: 'none',
          },
          cursor + 0.08,
        );

        // Fade out before reaching the destination node.
        tl.to(
          handles.group,
          { opacity: 0, duration: dur * 0.15, ease: 'none' },
          cursor + fadeOutAt,
        );

        // Sparkling wake: as the head passes each point along the leg it
        // deposits a tiny star that twinkles, drifts, and dissolves — so the
        // comet's trail lingers as stardust instead of vanishing at the node.
        const stars = createStardust(layerRef.current, path, color, cometScale, tl, cursor, dur);
        stardustRef.current.push(...stars);

        cursor += dur + 0.02;
      }
    }

    tlRef.current = tl;

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      flightsRef.current.forEach((f) => f.group.remove());
      flightsRef.current = [];
      stardustRef.current.forEach((s) => s.remove());
      stardustRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedShot]);

  // Speed updates without rebuilding the timeline.
  useEffect(() => {
    tlRef.current?.timeScale(speed);
  }, [speed]);

  return <g ref={layerRef} />;
}

function createFlight(parent: SVGGElement, leg: EdgeLeg, scale: number, tint: string | null): FlightHandles | null {
  const ns = 'http://www.w3.org/2000/svg';
  const color = tint ?? PROTO_COLOR[leg.proto];

  const group = document.createElementNS(ns, 'g');
  group.setAttribute('pointer-events', 'none');
  group.setAttribute('opacity', '1');

  const tail = document.createElementNS(ns, 'circle');
  tail.setAttribute('r', String(9 * scale));
  tail.setAttribute('fill', color);
  tail.setAttribute('fill-opacity', '0.18');
  tail.setAttribute('filter', 'url(#cosmos-packet-glow)');
  group.appendChild(tail);

  const glow = document.createElementNS(ns, 'circle');
  glow.setAttribute('r', String(5.5 * scale));
  glow.setAttribute('fill', color);
  glow.setAttribute('fill-opacity', '0.55');
  glow.setAttribute('filter', 'url(#cosmos-packet-glow)');
  group.appendChild(glow);

  const head = document.createElementNS(ns, 'circle');
  head.setAttribute('r', String(3 * scale));
  head.setAttribute('fill', '#FFFFFF');
  group.appendChild(head);

  parent.appendChild(group);

  return { group, tail, glow, head };
}

/** A tiny concave 4-point star, centred at the origin, radius `r`. */
function sparklePath(r: number): string {
  const waist = r * 0.3;
  return `M0,${-r}L${waist},${-waist}L${r},0L${waist},${waist}L0,${r}L${-waist},${waist}L${-r},0L${-waist},${-waist}Z`;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Deposits a wake of tiny star sparkles along `path`, timed to the moment the
 * comet head passes each point. Each sparkle pops in, drifts a little, twinkles
 * (a slow rotation + fade), and dissolves — turning the comet's trail into
 * stardust rather than letting it vanish at the destination node. Returns the
 * created elements so the caller can remove them when the shot is torn down.
 */
function createStardust(
  parent: SVGGElement,
  path: SVGPathElement,
  color: string,
  scale: number,
  tl: gsap.core.Timeline,
  cursor: number,
  dur: number,
): SVGElement[] {
  const ns = 'http://www.w3.org/2000/svg';
  const length = path.getTotalLength();
  if (length < 1) return [];

  // One sparkle roughly every 44 world-units, kept in a sane band so short
  // hops still shimmer and long ones don't flood the layer.
  const count = Math.max(5, Math.min(20, Math.round(length / 44)));
  const created: SVGElement[] = [];

  for (let i = 0; i < count; i += 1) {
    const fraction = (i + 0.5) / count;
    const at = path.getPointAtLength(length * fraction);
    const jitterX = rand(-5, 5) * scale;
    const jitterY = rand(-5, 5) * scale;

    const star = document.createElementNS(ns, 'path');
    star.setAttribute('d', sparklePath(rand(2.6, 3.8) * scale));
    // Most sparkles are white starlight; a few carry the wire colour so the
    // stardust keeps a hint of the protocol that flew through.
    star.setAttribute('fill', Math.random() < 0.28 ? color : '#FFFFFF');
    star.setAttribute('filter', 'url(#cosmos-packet-glow)');
    star.setAttribute('pointer-events', 'none');
    parent.appendChild(star);
    created.push(star);

    gsap.set(star, {
      x: at.x + jitterX,
      y: at.y + jitterY,
      opacity: 0,
      scale: 0.2,
      rotation: rand(-30, 30),
      transformOrigin: 'center',
    });

    // Head reaches this fraction at cursor + dur*fraction — spawn there.
    const bornAt = cursor + dur * fraction;
    const life = rand(0.9, 1.7);

    tl.to(star, { opacity: rand(0.75, 1), scale: 1, duration: 0.18, ease: 'power2.out' }, bornAt);
    tl.to(
      star,
      {
        opacity: 0,
        scale: 0.35,
        x: `+=${rand(-12, 12)}`,
        y: `+=${rand(-14, 6)}`,
        rotation: `+=${rand(-50, 50)}`,
        duration: life,
        ease: 'power1.out',
      },
      bornAt + 0.18,
    );
  }

  return created;
}
