import type { StaticImageData } from "next/image";
import tableTexture from "@/png/table/table.webp";
import tableTexture2 from "@/png/table/table2.webp";
import tableTexture3 from "@/png/table/table3.webp";
import tableTexture4 from "@/png/table/table4.webp";
import tableTexture5 from "@/png/table/table5.webp";
import tableTexture6 from "@/png/table/table6.webp";
import tableThumb from "@/png/table/thumbs/table.webp";
import tableThumb2 from "@/png/table/thumbs/table2.webp";
import tableThumb3 from "@/png/table/thumbs/table3.webp";
import tableThumb4 from "@/png/table/thumbs/table4.webp";
import tableThumb5 from "@/png/table/thumbs/table5.webp";
import tableThumb6 from "@/png/table/thumbs/table6.webp";
import type { TableclothId } from "@/store/uiStore";

export interface TableclothOption {
  id: TableclothId;
  name: string;
  texture: StaticImageData;
  /** 选择器预览用缩略图，避免为展示小图加载全尺寸贴图。 */
  thumb: StaticImageData;
}

export const TABLECLOTH_OPTIONS: TableclothOption[] = [
  { id: "table", name: "紫气东来", texture: tableTexture, thumb: tableThumb },
  { id: "table2", name: "锦鳞逐翠", texture: tableTexture2, thumb: tableThumb2 },
  { id: "table3", name: "鎏金盈瑞", texture: tableTexture3, thumb: tableThumb3 },
  { id: "table4", name: "青绒雅境", texture: tableTexture4, thumb: tableThumb4 },
  { id: "table5", name: "桃华映月", texture: tableTexture5, thumb: tableThumb5 },
  { id: "table6", name: "朱锦呈祥", texture: tableTexture6, thumb: tableThumb6 },
];

export function getTableclothOption(id: TableclothId): TableclothOption {
  return TABLECLOTH_OPTIONS.find((option) => option.id === id) ?? TABLECLOTH_OPTIONS[0];
}
