import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { backOut, power, powerInOut, ramp } from "../anim";
import { LeafMark } from "../LeafMark";
import { shellStyle, type Enter } from "../transitions";
import { colors, fonts } from "../theme";

const START = 33.1;
const enter: Enter = { kind: "circle", at: START, duration: 0.7, cx: 1420, cy: 560 };

const pulses = [33.5, 35.04, 36.1];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = START + frame / fps;
  const glyphIn = ramp(t, 33.5, 34.2, 0, 1, backOut(1.5));
  const float = ramp(t, 34.9, 35.9, 0, -16, (x) => Math.sin(x * Math.PI * 0.5));
  const swing = ramp(t, 36.1, 36.28, 0, -10, power(2)) + ramp(t, 36.28, 36.78, 0, 10, backOut(2.4));
  const panel = ramp(t, 37.0, 37.55, 100, 0, powerInOut(4));
  const word = ramp(t, 33.9, 34.4, 0, 1, power(4));
  const tag = ramp(t, 35.04, 35.54, 0, 1, power(3));
  const card2 = (at: number) => ramp(t, at, at + 0.5, 0, 1, power(3));
  const glyph2 = ramp(t, 37.2, 37.8, 0, 1, backOut(1.7));

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: colors.blue, ...shellStyle(t, enter) }}>
      {pulses.map((at) => {
        const p = ramp(t, at, at + 1.05, 0, 1, power(2));
        return (
          <div
            key={at}
            style={{
              position: "absolute",
              left: 760,
              top: 230,
              width: 400,
              height: 400,
              borderRadius: 200,
              background: "rgba(255,255,255,0.13)",
              opacity: t >= at ? 1 - p : 0,
              scale: 0.3 + 6.2 * p,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 810, top: 280, translate: `0px ${float}px`, scale: 0.2 + 0.8 * glyphIn, rotate: `${-25 * (1 - glyphIn) + swing}deg`, opacity: glyphIn > 0 ? Math.min(1, glyphIn * 3) : 0 }}>
        <LeafMark size={300} color="#ffffff" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: 1920,
          top: 520,
          textAlign: "center",
          color: "#ffffff",
          fontFamily: fonts.ui,
          fontWeight: 900,
          fontSize: 250,
          letterSpacing: "-0.06em",
          lineHeight: 1,
          opacity: word,
          translate: `0px ${60 * (1 - word)}px`,
          filter: `blur(${14 * (1 - word)}px)`,
        }}
      >
        Leaf
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: 1920,
          top: 790,
          textAlign: "center",
          color: "#ffffff",
          fontFamily: fonts.ui,
          fontWeight: 700,
          fontSize: 70,
          letterSpacing: "-0.03em",
          opacity: tag,
          translate: `0px ${36 * (1 - tag)}px`,
        }}
      >
        Own your workspace.
      </div>
      <AbsoluteFill style={{ background: colors.ink, clipPath: `inset(${panel}% 0% 0% 0%)` }}>
        <div style={{ position: "absolute", left: 0, width: 1920, top: 250, display: "flex", justifyContent: "center", alignItems: "center", gap: 40 }}>
          <LeafMark size={230} color={colors.blue} style={{ scale: 0.3 + 0.7 * glyph2, rotate: `${-30 * (1 - glyph2)}deg`, opacity: Math.min(1, glyph2 * 3) }} />
          <div
            style={{
              color: "#ffffff",
              fontFamily: fonts.ui,
              fontWeight: 900,
              fontSize: 270,
              letterSpacing: "-0.06em",
              lineHeight: 1,
              opacity: card2(37.3),
              translate: `${40 * (1 - card2(37.3))}px 0px`,
              filter: `blur(${10 * (1 - card2(37.3))}px)`,
            }}
          >
            Leaf
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, width: 1920, top: 640, textAlign: "center", color: "#ffffff", fontFamily: fonts.ui, fontWeight: 800, fontSize: 84, letterSpacing: "-0.035em", opacity: card2(37.55), translate: `0px ${40 * (1 - card2(37.55))}px` }}>
          github.com/arvoreeducacao/leaf
        </div>
        <div style={{ position: "absolute", left: 0, width: 1920, top: 790, textAlign: "center", color: colors.sky, fontFamily: fonts.ui, fontWeight: 600, fontSize: 46, opacity: card2(37.9), translate: `0px ${30 * (1 - card2(37.9))}px` }}>
          Open source · AGPL-3.0
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
