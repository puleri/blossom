import { BIOME_LABELS, BIOME_SLOT_INDICES } from "@/lib/game/constants";
import { getPlantCardById } from "@/lib/game/cards/details";
import { getPlantEngineProfile } from "@/lib/game/cards/engineProfiles";
import { getPlantSchoolBorderColor } from "@/lib/game/cards/schools";
import type { BiomeName, GardenSlot } from "@/lib/game/types";

interface GardenTableauProps {
  slots: GardenSlot[];
}

const BIOME_BACKGROUND_COLORS: Record<BiomeName, string> = {
  desert: "#f4d7a1",
  plains: "#cde9a3",
  rainforest: "#9fd8b6"
};

export function GardenTableau({ slots }: GardenTableauProps) {
  const biomes: BiomeName[] = ["desert", "plains", "rainforest"];

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
                const slot = slots[index] ?? { state: "empty", plantId: null };
                const plant = slot.plantId ? getPlantCardById(slot.plantId) : null;
                const profile = slot.plantId ? getPlantEngineProfile(slot.plantId) : null;
                const borderColor = slot.plantId ? getPlantSchoolBorderColor(slot.plantId) : "#ccc";

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
                            L{profile.level} · Sun {profile.sunCost}/{profile.sunCapacity} · {profile.engineSummary}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p style={{ margin: "6px 0", color: "#666" }}>{slot.state === "withered" ? "Withered" : "Empty"}</p>
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
