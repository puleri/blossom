import type { EventCard } from "@/lib/game/types";

export const EVENT_CARDS: EventCard[] = [
  { id: "rain", name: "Rain", description: "All players gain 2 water.", effectType: "water", value: 2, tags: ["weather"] },
  { id: "sprinkle", name: "Sprinkle", description: "All players gain 1 water.", effectType: "water", value: 1, tags: ["weather"] },
  { id: "dryHeat", name: "Dry Heat", description: "All players lose 1 water.", effectType: "water", value: -1, tags: ["weather"] },
  { id: "infestation", name: "Infestation", description: "All players gain 1 bug.", effectType: "bugs", value: 1, tags: ["pest"] },
  { id: "pollination", name: "Pollination", description: "All players gain 1 flower.", effectType: "flowers", value: 1, tags: ["pollination"] },
  { id: "seedBurst", name: "Seed Burst", description: "All players gain 1 seed.", effectType: "seeds", value: 1, tags: ["pollination"] },
  { id: "drought", name: "Drought", description: "All players lose 2 water.", effectType: "water", value: -2, tags: ["weather"] },
  { id: "ladybugs", name: "Ladybugs", description: "All players lose 1 bug.", effectType: "bugs", value: -1, tags: ["pest"] },
  { id: "gentleSun", name: "Gentle Sun", description: "All players gain 1 point.", effectType: "points", value: 1, tags: ["weather"] },
  { id: "coldSnap", name: "Cold Snap", description: "All players discard 1 flower.", effectType: "flowers", value: -1, tags: ["weather"] }
];
