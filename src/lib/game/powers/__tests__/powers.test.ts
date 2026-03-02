import test from "node:test";
import assert from "node:assert/strict";

import pollinateDraw2Tuck1 from "../../../../../fixtures/powers/pollinate_draw2_tuck1.json";
import rootSpendCompostDraw2 from "../../../../../fixtures/powers/root_spend_compost_draw2.json";
import rootTuckHandGainCompost from "../../../../../fixtures/powers/root_tuck_hand_gain_compost.json";
import { executePower } from "../interpreter";
import { validatePowerSchema } from "../schemaValidator";
import type { ExecutePowerContext, PowerDsl } from "../types";

function baseContext(): ExecutePowerContext {
  return {
    player: {
      id: "p1",
      resources: { compost: 1, water: 0, nutrients: 0, seeds: 0 },
      score: 0,
      hand: ["h1", "h2"]
    },
    selfPlant: {
      id: "plant-1",
      sunlight: 0,
      sunlightCapacity: 2,
      tucked: []
    },
    gameState: {
      deck: ["d1", "d2", "d3"],
      tray: ["t1"],
      players: []
    },
    chooseCardFromHand: () => 0
  };
}

test("schema validator returns path + reason errors", () => {
  const result = validatePowerSchema({ id: "bad", trigger: { kind: "onActivate" }, steps: [{ op: "gainResource" }] });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.includes("/") && (error.includes("required") || error.includes("Missing property"))), true);
});

test("schema validator accepts fixtures", () => {
  [rootSpendCompostDraw2, rootTuckHandGainCompost, pollinateDraw2Tuck1].forEach((fixture) => {
    const result = validatePowerSchema(fixture);
    assert.equal(result.valid, true, result.errors.join("\n"));
  });
});

test("Dustcap Mycelium: spend compost -> draw 2", () => {
  const result = executePower(rootSpendCompostDraw2 as PowerDsl, baseContext());
  assert.equal(result.player.resources.compost, 0);
  assert.deepEqual(result.player.hand, ["h1", "h2", "d1", "d2"]);
});

test("Gravecap Recycler: tuck from hand -> gain compost", () => {
  const result = executePower(rootTuckHandGainCompost as PowerDsl, baseContext());
  assert.deepEqual(result.selfPlant.tucked, ["h1"]);
  assert.deepEqual(result.player.hand, ["h2"]);
  assert.equal(result.player.resources.compost, 2);
});

test("Veilspore Archivist: draw 2 then tuck 1", () => {
  const result = executePower(pollinateDraw2Tuck1 as PowerDsl, baseContext());
  assert.deepEqual(result.player.hand, ["h2", "d1", "d2"]);
  assert.deepEqual(result.selfPlant.tucked, ["h1"]);
});
