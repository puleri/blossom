export type TriggerKind = "onActivate" | "onPlay" | "onMature";
export type ActivateRow = "root" | "pollinate" | "toTheSun";

export interface PowerTrigger {
  kind: TriggerKind;
  row?: ActivateRow;
}

export type RootResource = "water" | "nutrients" | "seeds" | "compost";

export interface PlantTarget {
  ref: "self";
}

export type PlayerRef = "self";

export type Condition =
  | { op: "hasSunlight"; plant: PlantTarget; atLeast: number }
  | {
      op: "count";
      scope: "playerTableau" | "row" | "allPlayers";
      predicate: { biome?: "oasisEdge" | "meadow" | "understory" | "canopy"; tag?: string; mature?: boolean };
      cmp: ">=" | ">" | "==" | "<=" | "<";
      value: number;
    };

export type Step =
  | { op: "if"; cond: Condition; then: Step[]; else?: Step[] }
  | { op: "choice"; options: Array<{ label: string; steps: Step[] }> }
  | { op: "gainResource"; resource: RootResource; amount: number; to: PlayerRef }
  | { op: "spendResource"; resource: RootResource; amount: number; from: PlayerRef }
  | { op: "gainSunlight"; amount: number; toPlant: PlantTarget; clampToCapacity?: boolean }
  | { op: "drawCards"; amount: number; to: PlayerRef; source: "deck" | "tray" | "deckOrTrayChoice" }
  | { op: "tuckCard"; amount: number; from: "hand" | "tray"; underPlant: PlantTarget }
  | { op: "scorePoints"; amount: number; to: PlayerRef };

export interface PowerDsl {
  id: string;
  trigger: PowerTrigger;
  oncePer?: "turn" | "activation" | "round" | "game";
  steps: Step[];
}

export interface RuntimePlant {
  id: string;
  biome?: "oasisEdge" | "meadow" | "understory" | "canopy";
  sunlight: number;
  sunlightCapacity: number;
  tucked: string[];
  mature?: boolean;
}

export interface RuntimePlayer {
  id: string;
  resources: Record<string, number>;
  score: number;
  hand: string[];
}

export interface RuntimeGameState {
  deck: string[];
  tray: string[];
  players: RuntimePlayer[];
}

export interface ExecutePowerContext {
  player: RuntimePlayer;
  selfPlant: RuntimePlant;
  gameState: RuntimeGameState;
  powersByPlantId?: Record<string, PowerDsl[]>;
  chooseOption?: (labels: string[]) => number;
  chooseCardFromHand?: (hand: string[]) => number;
  chooseCardFromTray?: (tray: string[]) => number;
}

export interface ExecutePowerResult {
  player: RuntimePlayer;
  selfPlant: RuntimePlant;
  gameState: RuntimeGameState;
  executed: string[];
}
