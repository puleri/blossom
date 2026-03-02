import { PLANT_CARDS } from "../cards/plants";
import { WINGSPAN_RESKIN_MAP } from "../cards/wingspanReskinMap";

import pollinateDraw2Tuck1 from "../../../../fixtures/powers/pollinate_draw2_tuck1.json";
import rootSpendCompostDraw2 from "../../../../fixtures/powers/root_spend_compost_draw2.json";
import rootTuckHandGainCompost from "../../../../fixtures/powers/root_tuck_hand_gain_compost.json";
import type { PowerDsl } from "./types";

export const powerRegistry: Record<string, PowerDsl> = {
  pollinate_draw2_tuck1: pollinateDraw2Tuck1 as PowerDsl,
  root_spend_compost_draw2: rootSpendCompostDraw2 as PowerDsl,
  root_tuck_hand_gain_compost: rootTuckHandGainCompost as PowerDsl
};

function getPowerOrThrow(powerId: string, source: string): PowerDsl {
  const power = powerRegistry[powerId];

  if (!power) {
    throw new Error(`Unknown power id "${powerId}" referenced by ${source}`);
  }

  return power;
}

function buildPlantCardPowers(): Record<string, PowerDsl[]> {
  const entries: Array<[string, PowerDsl[]]> = [];

  for (const plant of PLANT_CARDS) {
    const powerIds = plant.powerIds ?? [];

    if (powerIds.length === 0) {
      continue;
    }

    entries.push([
      plant.id,
      powerIds.map((powerId) => getPowerOrThrow(powerId, `plant card "${plant.id}"`))
    ]);
  }

  return Object.fromEntries(entries);
}

function buildWingspanParityPowers(): Record<string, PowerDsl[]> {
  const entries: Array<[string, PowerDsl[]]> = [];

  for (const mapping of WINGSPAN_RESKIN_MAP) {
    entries.push([
      mapping.originalWingspanCardId,
      [
        getPowerOrThrow(
          mapping.normalizedPowerId,
          `wingspan mapping "${mapping.originalWingspanCardId}"`
        )
      ]
    ]);
  }

  return Object.fromEntries(entries);
}

export const CARD_POWERS: Record<string, PowerDsl[]> = {
  ...buildPlantCardPowers(),
  ...buildWingspanParityPowers()
};
