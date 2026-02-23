import type { EventCard } from "@/lib/game/types";

export const EVENT_CARDS: EventCard[] = [
  { id: "rain", name: "Rain", description: "All players gain 2 water.", effectType: "water", value: 2 },
  { id: "sprinkle", name: "Sprinkle", description: "All players gain 1 water.", effectType: "water", value: 1 },
  { id: "dryHeat", name: "Dry Heat", description: "All players lose 1 water.", effectType: "water", value: -1 },
  { id: "infestation", name: "Infestation", description: "All players gain 1 bug.", effectType: "bugs", value: 1 },
  { id: "pollination", name: "Pollination", description: "All players gain 1 flower.", effectType: "flowers", value: 1 },
  { id: "seedBurst", name: "Seed Burst", description: "All players gain 1 seed.", effectType: "seeds", value: 1 },
  { id: "drought", name: "Drought", description: "All players lose 2 water.", effectType: "water", value: -2 },
  { id: "ladybugs", name: "Ladybugs", description: "All players lose 1 bug.", effectType: "bugs", value: -1 },
  { id: "gentleSun", name: "Gentle Sun", description: "All players gain 1 point.", effectType: "points", value: 1 },
  { id: "coldSnap", name: "Cold Snap", description: "All players discard 1 flower.", effectType: "flowers", value: -1 }
];
