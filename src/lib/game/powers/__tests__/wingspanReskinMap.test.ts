import test from "node:test";
import assert from "node:assert/strict";

import { WINGSPAN_RESKIN_MAP } from "../../cards/wingspanReskinMap";
import { CARD_POWERS } from "../cardPowers";
import { validatePowerSchema } from "../schemaValidator";
import type { PowerDsl } from "../types";

function mechanicalSignature(power: PowerDsl) {
  return {
    trigger: { kind: power.trigger.kind, row: power.trigger.row ?? null },
    steps: power.steps
  };
}

test("every mapped wingspan reskin has matching powers + valid schema", () => {
  assert.ok(WINGSPAN_RESKIN_MAP.length > 0, "Expected at least one wingspan reskin mapping.");

  for (const mapping of WINGSPAN_RESKIN_MAP) {
    const originalPowers = CARD_POWERS[mapping.originalWingspanCardId];
    const plantPowers = CARD_POWERS[mapping.plantCardId];

    assert.ok(originalPowers, `Missing original card powers: ${mapping.originalWingspanCardId}`);
    assert.ok(plantPowers, `Missing plant card powers: ${mapping.plantCardId}`);

    assert.equal(originalPowers.length, plantPowers.length, `Power count mismatch for ${mapping.originalWingspanCardId} and ${mapping.plantCardId}`);

    for (let i = 0; i < originalPowers.length; i += 1) {
      const originalPower = originalPowers[i];
      const plantPower = plantPowers[i];

      const originalSchema = validatePowerSchema(originalPower);
      const plantSchema = validatePowerSchema(plantPower);

      assert.equal(originalSchema.valid, true, `Original power schema invalid for ${mapping.originalWingspanCardId}: ${originalSchema.errors.join("; ")}`);
      assert.equal(plantSchema.valid, true, `Plant power schema invalid for ${mapping.plantCardId}: ${plantSchema.errors.join("; ")}`);

      assert.equal(
        originalPower.trigger.kind,
        plantPower.trigger.kind,
        `Trigger timing class mismatch: ${mapping.originalWingspanCardId} vs ${mapping.plantCardId}`
      );

      assert.deepEqual(
        mechanicalSignature(originalPower),
        mechanicalSignature(plantPower),
        `Mechanical effect mismatch: ${mapping.originalWingspanCardId} vs ${mapping.plantCardId}`
      );
    }
  }
});
