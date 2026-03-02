import { BIOME_LABELS, BIOME_SLOT_INDICES } from "@/lib/game/constants";
import { getPlantAbilityDescriptions, getPlantCardById, getPlantFlavorText } from "@/lib/game/cards/details";
import { getPlantEngineProfile } from "@/lib/game/cards/engineProfiles";
import { getPlantSchoolBorderColor } from "@/lib/game/cards/schools";
import type { BiomeName, GardenSlot } from "@/lib/game/types";

interface GardenTableauProps {
  slots: GardenSlot[];
}

function getSlotPlantId(slot: GardenSlot | string | null | undefined) {
  if (!slot || typeof slot === "string") {
    return null;
  }

  const legacySlot = slot as GardenSlot & {
    cardId?: string | null;
    plantCardId?: string | null;
  };

  return legacySlot.plantId ?? legacySlot.cardId ?? legacySlot.plantCardId ?? null;
}

function getSlotState(slot: GardenSlot | string | null | undefined): GardenSlot["state"] {
  if (!slot) {
    return "empty";
  }

  return typeof slot === "string" ? (slot as GardenSlot["state"]) : slot.state;
}

const BIOME_BACKGROUND_COLORS: Record<BiomeName, string> = {
  oasisEdge: "#f4d7a1",
  meadow: "#cde9a3",
  understory: "#9fd8b6"
};

export function GardenTableau({ slots }: GardenTableauProps) {
  const biomes: BiomeName[] = ["oasisEdge", "meadow", "understory"];

  return (
    <section>
      <h2>Garden Tableau</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {biomes.map((biome) => (
          <div
            key={biome}
            style={{ backgroundColor: BIOME_BACKGROUND_COLORS[biome], borderRadius: 8, padding: 8 }}
          >
            <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>{BIOME_LABELS[biome]}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 8 }}>
              {BIOME_SLOT_INDICES[biome].map((index) => {
                const slot = slots[index] ?? null;
                const slotState = getSlotState(slot);
                const plantId = getSlotPlantId(slot);
                const plant = plantId ? getPlantCardById(plantId) : null;
                const profile = plantId ? getPlantEngineProfile(plantId) : null;
                const borderColor = plantId ? getPlantSchoolBorderColor(plantId) : "#ccc";
                const abilityDescriptions = plant ? getPlantAbilityDescriptions(plant.id) : [];
                const generatedEngineSummary = abilityDescriptions.join(" ");

                return (
                  <div key={index} style={{ border: `2px solid ${borderColor}`, borderRadius: 4, padding: 8, minHeight: 130, background: "#fff" }}>
                    {plant ? (
                      <>
                        <p style={{ margin: "6px 0" }}>Plant: {plant.name}</p>
                        <p style={{ margin: "6px 0", fontSize: 12 }}>
                          Pts {plant.points}
                        </p>
                        <p style={{ margin: "6px 0", fontSize: 12 }}>
                          ID {plant.id}
                        </p>
                        {profile ? (
                          <p style={{ margin: "6px 0", fontSize: 12 }}>
                            L{profile.level} · Sun {profile.sunCost}/{profile.sunCapacity} · {generatedEngineSummary || profile.engineSummary}
                          </p>
                        ) : null}
                        <p style={{ margin: "6px 0", fontSize: 12, fontStyle: "italic", color: "#4b5563" }}>
                          “{getPlantFlavorText(plant.id)}”
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: "6px 0", color: "#666" }}>{slotState === "withered" ? "Withered" : "Empty"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
