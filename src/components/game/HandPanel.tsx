import { getPlantSummaryLabel } from "@/lib/game/cards/details";

interface HandPanelProps {
  hand: string[];
}

export function HandPanel({ hand }: HandPanelProps) {
  return (
    <section>
      <h2>Hand</h2>
      {hand.length === 0 ? (
        <p>No cards in hand.</p>
      ) : (
        <ul>
          {hand.map((cardId) => (
            <li key={cardId}>{getPlantSummaryLabel(cardId)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
