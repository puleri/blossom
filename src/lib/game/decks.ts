import type { EventCard } from "@/lib/game/types";

export interface DrawResult<T> {
  drawn: T[];
  remainingDeck: T[];
}

export function shuffleFisherYates<T>(cards: readonly T[], rng: () => number = Math.random): T[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = rng();
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function drawFromDeck<T>(deck: readonly T[], count: number): DrawResult<T> {
  const safeCount = Math.max(0, Math.floor(count));
  return {
    drawn: deck.slice(0, safeCount),
    remainingDeck: deck.slice(safeCount)
  };
}

export function drawSetupHands(playerIds: readonly string[], plantDeck: readonly string[], handSize = 5) {
  const hands: Record<string, string[]> = {};
  let remainingDeck = [...plantDeck];

  playerIds.forEach((playerId) => {
    const draw = drawFromDeck(remainingDeck, handSize);
    hands[playerId] = draw.drawn;
    remainingDeck = draw.remainingDeck;
  });

  return { hands, remainingDeck };
}

export function revealNextEvent(eventDeck: readonly EventCard[]) {
  const [event, ...remainingDeck] = eventDeck;
  return { event: event ?? null, remainingDeck };
}
