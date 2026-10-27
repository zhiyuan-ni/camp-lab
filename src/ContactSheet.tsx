import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { brand } from "./brand";

export type ContactSheetProps = {
  title: string;
  cols: number;
  tileWidth: number;
  tileHeight: number;
  tiles: { src: string; label: string }[];
};

export const SHEET_GAP = 16;
export const SHEET_HEADER = 70;
export const SHEET_LABEL = 34;

/** 关键帧总览图：由 scripts/contact-sheet.ts 传入截图，渲成一张 PNG */
export const ContactSheet: React.FC<ContactSheetProps> = ({ title, cols, tileWidth, tileHeight, tiles }) => (
  <AbsoluteFill style={{ background: "#111", fontFamily: brand.font, color: "#eee", padding: SHEET_GAP }}>
    <div style={{ height: SHEET_HEADER - SHEET_GAP, fontSize: 30, fontWeight: 700, display: "flex", alignItems: "center" }}>{title}</div>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)`, gap: SHEET_GAP }}>
      {tiles.map((t, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column" }}>
          <Img src={t.src} style={{ width: tileWidth, height: tileHeight, display: "block" }} />
          <div style={{ height: SHEET_LABEL, fontSize: 20, display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>{t.label}</div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
