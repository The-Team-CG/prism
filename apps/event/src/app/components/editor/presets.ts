import { ASSETS, assetToObject, uid } from "./assetLibrary";
import type { CanvasObject } from "./types";

export interface Preset {
  id: string;
  name: string;
  description: string;
  build: (widthM: number, heightM: number, pax: number) => CanvasObject[];
}

function findAsset(id: string) {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
}

function placeStage(widthM: number): CanvasObject {
  const stage = findAsset("stage");
  return {
    ...assetToObject(stage, widthM / 2, 1.8),
    id: uid("stage"),
  };
}

function banquetGrid(widthM: number, heightM: number, pax: number): CanvasObject[] {
  const round = findAsset("round-banquet");
  const tables: CanvasObject[] = [];
  const tablesNeeded = Math.ceil(pax / (round.seats || 10));
  const cols = Math.max(2, Math.floor((widthM - 2) / 3));
  const rows = Math.ceil(tablesNeeded / cols);
  const spacingX = (widthM - 2) / cols;
  const spacingY = Math.max(2.5, (heightM - 5) / Math.max(rows, 1));
  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (n > tablesNeeded) break;
      const cx = 1 + spacingX * (c + 0.5);
      const cy = 5 + spacingY * (r + 0.5);
      const obj = assetToObject(round, cx, cy);
      obj.label = `T${n}`;
      tables.push(obj);
      n++;
    }
  }
  return tables;
}

export const PRESETS: Preset[] = [
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start with an empty floor.",
    build: () => [],
  },
  {
    id: "corporate-gala",
    name: "Corporate Gala",
    description: "Stage + round banquet tables, LED wall.",
    build: (w, h, pax) => {
      const objs: CanvasObject[] = [];
      objs.push(placeStage(w));
      const led = findAsset("led-wall");
      objs.push(assetToObject(led, w / 2, 0.4));
      const pod = findAsset("podium");
      objs.push(assetToObject(pod, w / 2 + 2.5, 2));
      objs.push(...banquetGrid(w, h, pax));
      const reg = findAsset("reg-desk");
      objs.push(assetToObject(reg, 2, h - 1));
      return objs;
    },
  },
  {
    id: "wedding",
    name: "Wedding Reception",
    description: "VIP table up front, banquet rounds.",
    build: (w, h, pax) => {
      const objs: CanvasObject[] = [];
      objs.push(placeStage(w));
      const vip = findAsset("vip-table");
      objs.push(assetToObject(vip, w / 2, 4.5));
      objs.push(...banquetGrid(w, h, Math.max(pax - 10, 0)));
      return objs;
    },
  },
  {
    id: "conference",
    name: "Conference",
    description: "Classroom-style rows facing stage.",
    build: (w, h, pax) => {
      const objs: CanvasObject[] = [];
      objs.push(placeStage(w));
      const desk = findAsset("classroom");
      const seats = desk.seats || 2;
      const rows = Math.ceil(pax / seats / Math.max(1, Math.floor((w - 2) / 1.7)));
      const perRow = Math.max(1, Math.floor((w - 2) / 1.7));
      let n = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < perRow; c++) {
          if (n * seats >= pax) break;
          const cx = 1 + 1.7 * (c + 0.5);
          const cy = 5 + r * 1.2;
          objs.push(assetToObject(desk, cx, cy));
          n++;
        }
      }
      return objs;
    },
  },
  {
    id: "cocktail",
    name: "Cocktail",
    description: "Scatter of high-tops, buffet strip.",
    build: (w, h) => {
      const objs: CanvasObject[] = [];
      const ht = findAsset("cocktail");
      const count = Math.floor((w * (h - 4)) / 8);
      for (let i = 0; i < count; i++) {
        const cx = 1 + Math.random() * (w - 2);
        const cy = 4 + Math.random() * (h - 6);
        objs.push(assetToObject(ht, cx, cy));
      }
      const buf = findAsset("buffet");
      objs.push(assetToObject(buf, w / 2, h - 1));
      return objs;
    },
  },
  {
    id: "classroom",
    name: "Classroom",
    description: "Tight grid of desks.",
    build: (w, h, pax) => {
      const objs: CanvasObject[] = [];
      const desk = findAsset("classroom");
      const perRow = Math.max(1, Math.floor((w - 1) / 1.7));
      const rows = Math.ceil(pax / (desk.seats || 2) / perRow);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < perRow; c++) {
          const cx = 0.5 + 1.7 * (c + 0.5);
          const cy = 1.5 + r * 1.1;
          objs.push(assetToObject(desk, cx, cy));
        }
      }
      return objs;
    },
  },
  {
    id: "banquet",
    name: "Banquet",
    description: "Full room of round tables.",
    build: (w, h, pax) => banquetGrid(w, h, pax),
  },
];
