export type GameStatus = "lobby" | "in_progress" | "ended";

export type Phase = "lobby" | "setup" | "turns" | "upkeep" | "ended";

export type GardenSlotState = "empty" | "grown" | "withered";

export type BiomeName = "desert" | "plains" | "rainforest";

export interface GardenSlot {
  state: GardenSlotState;
  plantId: string | null;
  water?: number;
}

export type ResourceKey = "water" | "seeds" | "buds" | "flowers" | "bugs";

export interface PlayerResources {
  water: number;
  seeds: number;
  buds: number;
  flowers: number;
  bugs: number;
}

export interface PlantCard {
  id: string;
  name: string;
  points: number;
  waterCapacity: number;
  decayPerRound: number;
  requiresUpkeep: boolean;
  biome?: BiomeName | BiomeName[];
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  sunCost?: number;
  sunCapacity?: number;
  engineSummary?: string;
}

export type EventTag = "weather" | "pest" | "pollination";

export interface EventCard {
  id: string;
  name: string;
  description: string;
  effectType: ResourceKey | "points";
  value: number;
  tags: EventTag[];
}

export interface EventForecast {
  eventId: string;
  effectType: EventCard["effectType"];
  tags: EventTag[];
  polarity: "positive" | "negative";
}

export interface UpkeepEventResponse {
  choice: "mitigate" | "amplify" | "none";
  spentResource: "water" | null;
}

export interface BiomeActivationAnnouncement {
  id: string;
  playerId: string;
  biome: BiomeName;
  messages: string[];
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
  gardenSlots: GardenSlot[];
  gardenPlantIds?: Array<string | null>;
  abilityUsage?: Record<string, number>;
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
  remainingActions: number;
  eventDeck: EventCard[];
  plantDeck: string[];
  lastPhaseResolvedRound: number | null;
  currentEventId: string | null;
  nextEventForecast?: EventForecast | null;
  upkeepEventResponses?: Record<string, UpkeepEventResponse>;
  biomeActivationAnnouncement?: BiomeActivationAnnouncement | null;
  log?: string[];
}

export interface GameLogEntryDoc {
  message: string;
  playerId?: string | null;
  createdAt?: unknown;
  type: "system" | "action";
}
