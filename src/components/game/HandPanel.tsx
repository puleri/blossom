import { getPlantAbilityDescriptions, getPlantCardById } from "@/lib/game/cards/details";
import { getPlantSchoolBorderColor } from "@/lib/game/cards/schools";

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
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {hand.map((cardId) => {
            const card = getPlantCardById(cardId);
            const borderColor = getPlantSchoolBorderColor(cardId);

            return (
              <article
                key={cardId}
                style={{
                  border: `2px solid ${borderColor}`,
                  borderRadius: 6,
                  padding: 8,
                  minWidth: 180,
                  backgroundColor: "#fff",
                  color: "#1f2937"
                }}
              >
                <strong>{card?.name ?? cardId}</strong>
                {card ? (
                  <>
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      Seed {card.seedCost} · Pts {card.points} · Water {card.waterCapacity}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      Decay {card.decayPerRound} · Upkeep {card.requiresUpkeep ? "Yes" : "No"}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      Ability: {getPlantAbilityDescriptions(card.abilities).join(" · ")}
                    </p>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
