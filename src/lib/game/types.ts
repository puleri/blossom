export type GameStatus = "lobby" | "in_progress" | "ended";

export type Phase = "lobby" | "setup" | "event" | "turns" | "upkeep" | "ended";

export type GardenSlotState = "empty" | "seedling" | "grown" | "withered";

export type ResourceKey = "water" | "seeds" | "flowers" | "bugs";

export interface PlayerResources {
  water: number;
  seeds: number;
  flowers: number;
  bugs: number;
}

export interface PlantCard {
  id: string;
  name: string;
  seedCost: number;
  points: number;
  waterCapacity: number;
  decayPerRound: number;
  requiresUpkeep: boolean;
  abilities: string[];
}

export interface EventCard {
  id: string;
  name: string;
  description: string;
  effectType: ResourceKey | "points";
  value: number;
}

export interface PlayerDoc {
  id: string;
  displayName: string;
  uid: string;
  isHost: boolean;
  joinedAt?: unknown;
  resources: PlayerResources;
  score: number;
  hand: string[];
  gardenSlots: GardenSlotState[];
  keptFromMulligan: boolean;
}

export interface GameDoc {
  id: string;
  createdAt?: unknown;
  createdBy: string;
  status: GameStatus;
  phase: Phase;
  round: number;
  roundsTotal: number;
  hostPlayerId: string;
  activePlayerId: string | null;
  playerOrder: string[];
  turnIndex: number;
  eventDeck: EventCard[];
  plantDeck: string[];
  lastPhaseResolvedRound: number | null;
  currentEventId: string | null;
  log?: string[];
}

export interface GameLogEntryDoc {
  message: string;
  playerId?: string | null;
  createdAt?: unknown;
  type: "system" | "action";
}
