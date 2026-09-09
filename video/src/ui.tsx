import React from "react";
import { AbsoluteFill } from "remotion";
import { dark, fonts } from "./theme";
import { useFadeIn, useSpringAt } from "./motion";

export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: dark.bg,
      fontFamily: fonts.ui,
      color: dark.text,
      backgroundImage:
        "radial-gradient(1200px 600px at 50% -10%, rgba(39,131,222,0.16), transparent 70%)",
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Headline: React.FC<{
  children: React.ReactNode;
  startFrame?: number;
  size?: number;
  top?: number;
}> = ({ children, startFrame = 0, size = 64, top = 96 }) => {
  const s = useSpringAt(startFrame);
  const opacity = useFadeIn(startFrame, 10);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: size,
        fontWeight: 700,
        letterSpacing: -1.5,
        color: dark.textStrong,
        opacity,
        transform: `translateY(${(1 - s) * 24}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const Caption: React.FC<{
  children: React.ReactNode;
  startFrame?: number;
  bottom?: number;
}> = ({ children, startFrame = 0, bottom = 84 }) => {
  const opacity = useFadeIn(startFrame, 12);
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: 30,
        fontWeight: 400,
        color: dark.muted,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

export const Window: React.FC<{
  children: React.ReactNode;
  width: number;
  height: number;
  startFrame?: number;
  background: string;
  top?: number;
}> = ({ children, width, height, startFrame = 0, background, top }) => {
  const s = useSpringAt(startFrame, { damping: 20, stiffness: 90 });
  return (
    <div
      style={{
        position: "absolute",
        left: (1920 - width) / 2,
        top: top ?? (1080 - height) / 2 + 30,
        width,
        height,
        borderRadius: 18,
        overflow: "hidden",
        background,
        boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
        opacity: s,
        transform: `translateY(${(1 - s) * 60}px) scale(${0.96 + s * 0.04})`,
      }}
    >
      {children}
    </div>
  );
};

export const Pill: React.FC<{
  children: React.ReactNode;
  color: string;
  bg: string;
  style?: React.CSSProperties;
}> = ({ children, color, bg, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 16px",
      borderRadius: 999,
      fontSize: 22,
      fontWeight: 600,
      color,
      background: bg,
      ...style,
    }}
  >
    {children}
  </div>
);
