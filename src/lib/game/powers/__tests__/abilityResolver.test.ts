import test from "node:test";
import assert from "node:assert/strict";

import { resolveOncePerTurnActivation } from "../../abilityResolver";
import { PLANT_CARDS } from "../../cards/plants";
import { powerRegistry } from "../cardPowers";
import type { PlayerDoc } from "../../types";

function makePlayer(plantId: string, compost = 1): PlayerDoc {
  return {
    id: "p1",
    uid: "u1",
    displayName: "P1",
    isHost: true,
    keptFromMulligan: true,
    resources: { water: 0, nutrients: 0, seeds: 0, compost },
    score: 0,
    hand: [],
    gardenSlots: Array.from({ length: 15 }, (_, index) => ({
      state: index === 0 ? "grown" : "empty",
      plantId: index === 0 ? plantId : null,
      water: 0
    })) as unknown as PlayerDoc["gardenSlots"],
    abilityUsage: {}
  };
}

test("card with no power IDs does not trigger", () => {
  const result = resolveOncePerTurnActivation(makePlayer("strawberry-bush"), 0, 1);
  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.player.abilityUsage, {});
});

test("card with valid onActivate power triggers", () => {
  const result = resolveOncePerTurnActivation(makePlayer("dustcap-mycelium", 1), 0, 2);
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0]?.abilityId, "root_spend_compost_draw2");
  assert.equal(result.player.resources.compost, 0);
});

test("oncePer turn power cannot trigger twice in same turn", () => {
  const first = resolveOncePerTurnActivation(makePlayer("dustcap-mycelium", 2), 0, 3);
  assert.equal(first.logs.length, 1);
  assert.equal(first.player.resources.compost, 1);

  const second = resolveOncePerTurnActivation(first.player, 0, 3);
  assert.deepEqual(second.logs, []);
  assert.equal(second.player.resources.compost, 1);
});

test("coverage gate: every plant card powerId resolves to power registry", () => {
  const allPowerIds = PLANT_CARDS.flatMap((card) => card.powerIds ?? []);

  allPowerIds.forEach((powerId) => {
    assert.ok(powerRegistry[powerId], `Missing power fixture for ${powerId}`);
  });
});
