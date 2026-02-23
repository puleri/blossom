export type GameStatus = "lobby" | "in_progress" | "ended";

export type Phase = "lobby" | "setup" | "active" | "ended";

export type GardenSlotState = "empty" | "seedling" | "grown" | "withered";

export interface PlantCard {
  id: string;
  name: string;
  growthCost: number;
  scoreValue: number;
  growthTurns: number;
}

export interface EventCard {
  id: string;
  name: string;
  description: string;
  effectType: "resource" | "garden" | "draw" | "score";
  value: number;
}

export interface PlayerDoc {
  id: string;
  displayName: string;
  isHost: boolean;
  joinedAt?: unknown;
  resources: number;
  score: number;
  hand: PlantCard[];
  gardenSlots: GardenSlotState[];
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
  eventDeck: EventCard[];
  log: string[];
}
