import React from "react";
import { AbsoluteFill, CanvasImage, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { backOut, power, ramp } from "../anim";
import { cameraAt, cameraStyle, type Shot } from "../camera";
import { shellStyle, type Enter } from "../transitions";
import { colors, fonts } from "../theme";

const START = 27.75;
const COMMAND = "docker compose up";
const TYPING_AT = 28.75;
const TYPING_STEP = 0.052;

const enter: Enter = { kind: "wipeRight", at: START, duration: 0.55 };

const shots: ReadonlyArray<Shot> = [
  { at: 28.6, duration: 0.8, scale: 1.45, fx: 662, fy: 640 },
  { at: 30.3, duration: 0.7, scale: 1, fx: 960, fy: 540 },
  { at: 32.4, duration: 0.8, scale: 1.22, fx: 1090, fy: 600 },
];

const outputs = [
  { at: 30.39, text: "✔ Network leaf_default  Created", color: colors.green },
  { at: 30.7, text: "✔ Container leaf-db     Healthy", color: colors.green },
  { at: 31.0, text: "✔ Container leaf-app    Started", color: colors.green },
  { at: 31.45, text: "▲ Ready on localhost:3000", color: colors.sky },
];

const Line: React.FC<{ t: number; at: number; color: string; children: React.ReactNode }> = ({ t, at, color, children }) => (
  <div
    style={{
      whiteSpace: "pre",
      color,
      opacity: ramp(t, at, at + 0.2, 0, 1, power(2)),
      translate: `${-24 * (1 - ramp(t, at, at + 0.2, 0, 1, power(3)))}px 0px`,
    }}
  >
    {children}
  </div>
);

export const Peak: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = START + frame / fps;
  const typed = Math.max(0, Math.min(COMMAND.length, Math.floor((t - TYPING_AT) / TYPING_STEP) + 1));
  const slam = ramp(t, 28.07, 28.52, 0, 1, power(4));
  const termIn = ramp(t, 28.3, 28.8, 0, 1, power(3));
  const browserIn = ramp(t, 31.6, 32.3, 0, 1, power(4));
  const browserFloat = ramp(t, 32.3, 33.7, 0, 1, (x) => Math.sin(x * Math.PI));

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: colors.ink, ...shellStyle(t, enter) }}>
      <AbsoluteFill style={{ ...cameraStyle(cameraAt(t, shots)), transformOrigin: "50% 50%" }}>
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 96,
            fontFamily: fonts.ui,
            fontWeight: 900,
            fontSize: 150,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            color: "#ffffff",
            whiteSpace: "nowrap",
            opacity: slam,
            scale: 1.18 - 0.18 * slam,
            filter: `blur(${14 * (1 - slam)}px)`,
            transformOrigin: "0% 100%",
          }}
        >
          One <span style={{ color: colors.blue }}>command.</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 330,
            width: 1010,
            height: 560,
            borderRadius: 26,
            background: "#0d1726",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 50px 120px rgba(0,0,0,0.55)",
            overflow: "hidden",
            opacity: termIn,
            translate: `0px ${80 * (1 - termIn)}px`,
          }}
        >
          <div style={{ height: 62, background: "#16243a", display: "flex", alignItems: "center", gap: 12, padding: "0 26px" }}>
            {["#ff6058", "#ffbd2e", "#28c940"].map((c) => (
              <span key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c, display: "block" }} />
            ))}
          </div>
          <div style={{ padding: "34px 40px", fontFamily: fonts.mono, fontSize: 36, lineHeight: 1.55, color: "#d7e0ee" }}>
            <div style={{ whiteSpace: "pre", opacity: t >= 28.7 ? 1 : 0 }}>
              <span style={{ color: colors.green }}>$ </span>
              {COMMAND.slice(0, typed)}
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 40,
                  background: "#d7e0ee",
                  verticalAlign: -6,
                  opacity: t >= 28.7 && t < 30.3 ? 1 : 0,
                }}
              />
            </div>
            {outputs.map((line) => (
              <Line key={line.text} t={t} at={line.at} color={line.color}>
                {line.text}
              </Line>
            ))}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 1040,
            top: 250,
            width: 760,
            height: 560,
            borderRadius: 22,
            background: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 60px 140px rgba(0,0,0,0.6)",
            opacity: ramp(t, 31.6, 31.95, 0, 1, power(2)),
            translate: `0px ${360 * (1 - browserIn) - 14 * browserFloat}px`,
            scale: 0.86 + 0.14 * browserIn,
            transform: `perspective(2200px) rotateY(${-16 + 9 * browserIn + 3 * browserFloat}deg)`,
          }}
        >
          <div style={{ position: "relative", zIndex: 2, height: 64, background: "#eef1f6", display: "flex", alignItems: "center", padding: "0 22px" }}>
            <div style={{ flex: 1, height: 42, borderRadius: 21, background: "#ffffff", color: "#44566e", fontFamily: fonts.ui, fontWeight: 500, fontSize: 30, display: "flex", alignItems: "center", padding: "0 20px" }}>
              localhost:3000
            </div>
          </div>
          <CanvasImage src={staticFile("signup.png")} style={{ position: "absolute", left: -315, top: -60, width: 1400, height: 787 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
