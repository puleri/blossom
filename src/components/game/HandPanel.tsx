import { ReactNode } from "react";
import { getPlantAbilityDescriptions, getPlantCardById } from "@/lib/game/cards/details";
import { getPlantEngineProfile } from "@/lib/game/cards/engineProfiles";
import { getPlantSchoolBorderColor } from "@/lib/game/cards/schools";

interface HandPanelProps {
  hand: string[];
  children?: ReactNode;
}

export function HandPanel({ hand, children }: HandPanelProps) {
  return (
    <section>
      <h2>Hand</h2>
      {hand.length === 0 ? (
        <p>No cards in hand.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {hand.map((cardId) => {
            const card = getPlantCardById(cardId);
            const profile = getPlantEngineProfile(cardId);
            const borderColor = getPlantSchoolBorderColor(cardId);

            return (
              <article
                key={cardId}
                style={{
                  border: `4px solid ${borderColor}`,
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
                      Pts {card.points} · Water {card.waterCapacity}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      Decay {card.decayPerRound} · Upkeep {card.requiresUpkeep ? "Yes" : "No"}
                    </p>
                    {profile ? (
                      <p style={{ margin: "6px 0", fontSize: 12 }}>
                        {profile.biome.toUpperCase()} · L{profile.level} · Sun cost {profile.sunCost}/{profile.sunCapacity}
                      </p>
                    ) : null}
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      Engine: {profile?.engineSummary}
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
      {children ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </section>
  );
}
