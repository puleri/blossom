import { ReactNode, useState } from "react";
import { getPlantAbilityDescriptions, getPlantCardById, getPlantFlavorText } from "@/lib/game/cards/details";
import { getPlantEngineProfile } from "@/lib/game/cards/engineProfiles";
import { getPlantSchoolBorderColor } from "@/lib/game/cards/schools";
import { BIOME_LABELS } from "@/lib/game/constants";
import type { BiomeName } from "@/lib/game/types";

interface HandPanelProps {
  hand: string[];
  canPlant?: boolean;
  busyAction?: string | null;
  availableBiomesByPlantId?: Partial<Record<string, BiomeName[]>>;
  onPlantFromHand?: (plantId: string, biome: BiomeName) => void;
  children?: ReactNode;
}

const BIOME_BUTTON_THEME: Record<BiomeName, { background: string; border: string; color: string }> = {
  oasisEdge: { background: "#f4d7a1", border: "#d6b272", color: "#4c3513" },
  meadow: { background: "#cde9a3", border: "#9bc260", color: "#23400f" },
  understory: { background: "#9fd8b6", border: "#5aa67f", color: "#093b26" }
};

export function HandPanel({ hand, canPlant = false, busyAction = null, availableBiomesByPlantId = {}, onPlantFromHand, children }: HandPanelProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  function handlePlantClick(cardId: string, biome: BiomeName) {
    console.log("[plant-flow] HandPanel plant button clicked", {
      cardId,
      biome,
      canPlant,
      busyAction,
      availableBiomes: availableBiomesByPlantId[cardId] ?? []
    });

    onPlantFromHand?.(cardId, biome);
  }

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
            const abilityDescriptions = card ? getPlantAbilityDescriptions(card.id) : [];
            const generatedEngineSummary = abilityDescriptions.join(" ");

            return (
              <article
                key={cardId}
                onMouseEnter={() => setActiveCardId(cardId)}
                onMouseLeave={() => setActiveCardId((previous) => (previous === cardId ? null : previous))}
                onFocus={() => setActiveCardId(cardId)}
                onBlur={() => setActiveCardId((previous) => (previous === cardId ? null : previous))}
                tabIndex={0}
                style={{
                  position: "relative",
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
                      Pts {card.points}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      ID {card.id}
                    </p>
                    {profile ? (
                      <p style={{ margin: "6px 0", fontSize: 12 }}>
                        {BIOME_LABELS[profile.biome]} · L{profile.level} · Sun cost {profile.sunCost}/{profile.sunCapacity}
                      </p>
                    ) : null}
                    <p style={{ margin: "6px 0", fontSize: 12 }}>
                      Engine: {generatedEngineSummary || profile?.engineSummary}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 12, fontStyle: "italic", color: "#4b5563" }}>
                      “{getPlantFlavorText(card.id)}”
                    </p>

                    {canPlant && onPlantFromHand ? (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 6,
                          borderRadius: 6,
                          backgroundColor: "rgba(134, 239, 172, 0.18)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          opacity: activeCardId === cardId ? 1 : 0,
                          transform: activeCardId === cardId ? "translateY(0)" : "translateY(-4px)",
                          transition: "opacity 180ms ease, transform 180ms ease",
                          pointerEvents: activeCardId === cardId ? "auto" : "none"
                        }}
                        aria-hidden={activeCardId !== cardId}
                      >
                        {(availableBiomesByPlantId[cardId] ?? []).map((biome) => {
                          const theme = BIOME_BUTTON_THEME[biome];

                          return (
                            <button
                              key={`${cardId}-${biome}`}
                              type="button"
                              onClick={() => handlePlantClick(cardId, biome)}
                              disabled={Boolean(busyAction)}
                              style={{
                                backgroundColor: theme.background,
                                borderColor: theme.border,
                                color: theme.color,
                                borderStyle: "solid",
                                borderWidth: 1,
                                borderRadius: 4,
                                padding: "4px 8px",
                                textAlign: "left",
                                cursor: busyAction ? "wait" : "pointer"
                              }}
                            >
                              {busyAction === "sow" ? "Planting..." : `Plant in ${BIOME_LABELS[biome]} Canopy`}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
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
