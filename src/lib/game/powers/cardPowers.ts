import dustcap from "../../../../fixtures/powers/dustcap.json";
import gravecap from "../../../../fixtures/powers/gravecap.json";
import veilspore from "../../../../fixtures/powers/veilspore.json";
import type { PowerDsl } from "@/lib/game/powers/types";

export const CARD_POWERS: Record<string, PowerDsl[]> = {
  "dustcap-mycelium": [dustcap as PowerDsl],
  "gravecap-recycler": [gravecap as PowerDsl],
  "veilspore-archivist": [veilspore as PowerDsl]
};
