import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { backOut, power, powerIn, powerInOut, ramp } from "../anim";
import { colors, fonts } from "../theme";

const line: React.CSSProperties = {
  position: "absolute",
  left: 130,
  fontFamily: fonts.ui,
  fontWeight: 900,
  fontSize: 214,
  lineHeight: 1,
  letterSpacing: "-0.055em",
  whiteSpace: "nowrap",
  color: "#ffffff",
};

const swapBox: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
  overflow: "hidden",
  height: "1.06em",
  width: "2.56em",
  verticalAlign: "top",
};

const swapWord: React.CSSProperties = { position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" };

const Swap: React.FC<{ t: number; at: number; rest: string }> = ({ t, at, rest }) => {
  const out = ramp(t, at, at + 0.3, 0, 1, powerIn(3));
  const inn = ramp(t, at + 0.08, at + 0.42, 0, 1, backOut(1.6));
  const shift = ramp(t, at + 0.04, at + 0.36, 0, 1, powerInOut(3));
  return (
    <>
      <span style={swapBox}>
        <span style={{ ...swapWord, color: colors.mute, translate: `0px ${-105 * out}%` }}>Their</span>
        <span style={{ ...swapWord, color: colors.blue, translate: `0px ${105 * (1 - inn)}%` }}>Your</span>
      </span>
      <span
        style={{
          display: "inline-block",
          translate: `${-52 * shift}px 0px`,
          color: shift > 0.5 ? "#ffffff" : colors.mute,
        }}
      >
        {rest}
      </span>
    </>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const drift = ramp(t, 3.9, 4.8, 0, -40, powerInOut(1.2));

  const appear = (at: number) => ramp(t, at, at + 0.32, 0, 1, power(4));

  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <div style={{ ...line, top: 150, scale: 1 + 0.04 * (1 - ramp(t, 0.21, 0.53, 0, 1, power(4))), transformOrigin: "0% 50%", translate: `${drift}px 0px` }}>
        Your docs.
      </div>
      <div
        style={{
          ...line,
          top: 375,
          opacity: appear(1.49),
          filter: `blur(${18 * (1 - appear(1.49))}px)`,
          translate: `${drift}px ${70 * (1 - appear(1.49))}px`,
        }}
      >
        <Swap t={t} at={3.69} rest="server." />
      </div>
      <div
        style={{
          ...line,
          top: 600,
          opacity: appear(2.53),
          filter: `blur(${18 * (1 - appear(2.53))}px)`,
          translate: `${drift}px ${70 * (1 - appear(2.53))}px`,
        }}
      >
        <Swap t={t} at={3.83} rest="rules." />
      </div>
    </AbsoluteFill>
  );
};
