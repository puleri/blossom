import { getPlantAbilityDescriptions, getPlantCardById } from "@/lib/game/cards/details";
import type { GardenSlot } from "@/lib/game/types";

interface GardenTableauProps {
  slots: GardenSlot[];
}

export function GardenTableau({ slots }: GardenTableauProps) {
  const totalSlots = 24;

  return (
    <section>
      <h2>Garden Tableau</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(120px, 1fr))", gap: 8 }}>
        {Array.from({ length: totalSlots }, (_, index) => {
          const slot = slots[index] ?? { state: "empty", plantId: null };
          const plant = slot.plantId ? getPlantCardById(slot.plantId) : null;

          return (
            <div key={index} style={{ border: "1px solid #ccc", borderRadius: 4, padding: 8, minHeight: 130 }}>
              <strong>Slot {index + 1}</strong>
              <p style={{ margin: "6px 0" }}>State: {slot.state}</p>
              {plant ? (
                <>
                  <p style={{ margin: "6px 0" }}>{plant.name}</p>
                  <p style={{ margin: "6px 0", fontSize: 12 }}>
                    Seed {plant.seedCost} · Pts {plant.points} · Water {plant.waterCapacity}
                  </p>
                  <p style={{ margin: "6px 0", fontSize: 12 }}>
                    Decay {plant.decayPerRound} · Upkeep {plant.requiresUpkeep ? "Yes" : "No"}
                  </p>
                  <p style={{ margin: "6px 0", fontSize: 12 }}>
                    Ability: {getPlantAbilityDescriptions(plant.abilities).join(" · ")}
                  </p>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
