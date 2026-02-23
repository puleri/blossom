import type { PlantCard } from "@/lib/game/types";

interface HandPanelProps {
  hand: PlantCard[];
}

export function HandPanel({ hand }: HandPanelProps) {
  return (
    <section>
      <h2>Hand</h2>
      {hand.length === 0 ? (
        <p>No cards in hand.</p>
      ) : (
        <ul>
          {hand.map((card) => (
            <li key={card.id}>
              {card.name} (Cost {card.growthCost}, Score {card.scoreValue})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
