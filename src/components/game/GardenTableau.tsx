import type { GardenSlotState } from "@/lib/game/types";

interface GardenTableauProps {
  slots: GardenSlotState[];
}

export function GardenTableau({ slots }: GardenTableauProps) {
  return (
    <section>
      <h2>Garden Tableau</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(80px, 1fr))", gap: 8 }}>
        {slots.map((slot, index) => (
          <div key={index} style={{ border: "1px solid #ccc", borderRadius: 4, padding: 8 }}>
            Slot {index + 1}: {slot}
          </div>
        ))}
      </div>
    </section>
  );
}
