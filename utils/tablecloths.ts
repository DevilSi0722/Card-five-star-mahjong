import type { StaticImageData } from "next/image";
import tableTexture from "@/png/table/table.png";
import tableTexture2 from "@/png/table/table2.png";
import tableTexture3 from "@/png/table/table3.png";
import tableTexture4 from "@/png/table/table4.png";
import tableTexture5 from "@/png/table/table5.png";
import tableTexture6 from "@/png/table/table6.png";
import type { TableclothId } from "@/store/uiStore";

export interface TableclothOption {
  id: TableclothId;
  name: string;
  texture: StaticImageData;
}

export const TABLECLOTH_OPTIONS: TableclothOption[] = [
  { id: "table", name: "紫气东来", texture: tableTexture },
  { id: "table2", name: "锦鳞逐翠", texture: tableTexture2 },
  { id: "table3", name: "鎏金盈瑞", texture: tableTexture3 },
  { id: "table4", name: "青绒雅境", texture: tableTexture4 },
  { id: "table5", name: "桃华映月", texture: tableTexture5 },
  { id: "table6", name: "朱锦呈祥", texture: tableTexture6 },
];

export function getTableclothOption(id: TableclothId): TableclothOption {
  return TABLECLOTH_OPTIONS.find((option) => option.id === id) ?? TABLECLOTH_OPTIONS[0];
}
