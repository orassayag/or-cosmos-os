/**
 * Barrel — re-exports every named symbol that consumers already import from
 * this path. Splitting into focused modules keeps each file under ~400 lines.
 */
export { SERVICES, SERVICES_BY_ID } from './services';
export { TOPICS, TOPICS_BY_ID } from './topics';
export { DOMAINS, SCENARIOS, SCENARIOS_BY_ID, scenariosForDomain, readyScenariosForDomain } from './scenarios';
export {
  DRIFT_ENTRIES,
  DRIFT_KIND_META,
  LATEST_DRIFT_DATE,
  LATEST_DRIFT_ENTRIES,
  LATEST_DRIFT_BY_NODE,
  driftEntriesByRun,
  driftPrUrl,
  driftCommitUrl,
  driftBranch,
  driftPrName,
  driftEntryMatches,
} from './drift';
export type { DriftEntry, DriftKind } from './drift';

import type { Scenario, Step } from './types';
import { SHOPPING_STEPS } from './steps/shopping';
import { FULFILLMENT_STEPS } from './steps/fulfillment';
import { ENGAGEMENT_STEPS } from './steps/engagement';

export const STEPS: Step[] = [
  ...SHOPPING_STEPS,
  ...FULFILLMENT_STEPS,
  ...ENGAGEMENT_STEPS,
];

export function stepsForScenario(scenario: Scenario): Step[] {
  if (scenario.phaseId == null) return [];
  return STEPS.filter(s => s.phase === scenario.phaseId);
}
