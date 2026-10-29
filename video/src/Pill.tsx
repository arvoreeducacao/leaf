import React from "react";
import { backOut, power, powerIn, ramp } from "./anim";
import { colors, fonts } from "./theme";

type Props = Readonly<{
  t: number;
  at: number;
  until: number;
  x: number;
  y: number;
  lead: string;
  accent: string;
  from?: "left" | "bottom";
}>;

export const Pill: React.FC<Props> = ({ t, at, until, x, y, lead, accent, from = "bottom" }) => {
  const enter = ramp(t, at, at + 0.45, 0, 1, backOut(1.8));
  const leave = ramp(t, until, until + 0.25, 0, 1, powerIn(2));
  const offset = (1 - enter) * 40 + leave * 40;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "26px 46px 30px",
        borderRadius: 28,
        background: "#ffffff",
        color: colors.ink,
        fontFamily: fonts.ui,
        fontWeight: 800,
        fontSize: 76,
        lineHeight: 1,
        letterSpacing: "-0.035em",
        whiteSpace: "nowrap",
        boxShadow: "0 30px 80px rgba(11, 19, 32, 0.28), 0 4px 14px rgba(11, 19, 32, 0.14)",
        opacity: ramp(t, at, at + 0.2, 0, 1, power(2)) * (1 - leave),
        translate: from === "left" ? `${-offset}px 0px` : `0px ${offset}px`,
        scale: 0.82 + 0.18 * enter,
        transformOrigin: "0% 100%",
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 9, background: colors.blue, display: "block" }} />
      <span>
        {lead} <span style={{ color: colors.blue }}>{accent}</span>
      </span>
    </div>
  );
};
