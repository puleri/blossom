import pollinateDraw2Tuck1 from "../../../../fixtures/powers/pollinate_draw2_tuck1.json";
import rootSpendCompostDraw2 from "../../../../fixtures/powers/root_spend_compost_draw2.json";
import rootTuckHandGainCompost from "../../../../fixtures/powers/root_tuck_hand_gain_compost.json";
import type { PowerDsl } from "./types";

const NORMALIZED_POWER_REGISTRY: Record<string, PowerDsl> = {
  pollinate_draw2_tuck1: pollinateDraw2Tuck1 as PowerDsl,
  root_spend_compost_draw2: rootSpendCompostDraw2 as PowerDsl,
  root_tuck_hand_gain_compost: rootTuckHandGainCompost as PowerDsl
};

export function getNormalizedPowerById(powerId: string): PowerDsl | null {
  return NORMALIZED_POWER_REGISTRY[powerId] ?? null;
}

export const CARD_POWERS: Record<string, PowerDsl[]> = {
  "dustcap-mycelium": [NORMALIZED_POWER_REGISTRY.root_spend_compost_draw2],
  "gravecap-recycler": [NORMALIZED_POWER_REGISTRY.root_tuck_hand_gain_compost],
  "veilspore-archivist": [NORMALIZED_POWER_REGISTRY.pollinate_draw2_tuck1],

  "wingspan.common-raven": [NORMALIZED_POWER_REGISTRY.root_spend_compost_draw2],
  "wingspan.chipping-sparrow": [NORMALIZED_POWER_REGISTRY.root_tuck_hand_gain_compost],
  "wingspan.barn-swallow": [NORMALIZED_POWER_REGISTRY.pollinate_draw2_tuck1]
};
