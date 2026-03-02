export interface WingspanReskinMapping {
  originalWingspanCardId: string;
  plantCardId: string;
  normalizedPowerId: string;
}

export const WINGSPAN_RESKIN_MAP: WingspanReskinMapping[] = [
  {
    originalWingspanCardId: "wingspan.common-raven",
    plantCardId: "dustcap-mycelium",
    normalizedPowerId: "root_spend_compost_draw2"
  },
  {
    originalWingspanCardId: "wingspan.chipping-sparrow",
    plantCardId: "gravecap-recycler",
    normalizedPowerId: "root_tuck_hand_gain_compost"
  },
  {
    originalWingspanCardId: "wingspan.barn-swallow",
    plantCardId: "veilspore-archivist",
    normalizedPowerId: "pollinate_draw2_tuck1"
  }
];

export const WINGSPAN_RESKIN_MAP_BY_PLANT_ID = Object.fromEntries(
  WINGSPAN_RESKIN_MAP.map((mapping) => [mapping.plantCardId, mapping])
);
