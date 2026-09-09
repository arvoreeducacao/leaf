import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { LeafLogo } from "../LeafLogo";
import { useFadeIn, useSpringAt } from "../motion";
import { dark } from "../theme";
import { Stage } from "../ui";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = useSpringAt(0, { damping: 14, stiffness: 110 });
  const wordmark = useSpringAt(14, { damping: 18, stiffness: 120 });
  const tagline = useFadeIn(30, 14);
  const rotate = interpolate(logo, [0, 1], [-18, 0]);
  const shift = interpolate(wordmark, [0, 1], [0, 1]);

  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              transform: `scale(${logo}) rotate(${rotate}deg) translateX(${(1 - shift) * 120}px)`,
              opacity: logo,
            }}
          >
            <LeafLogo size={168} />
          </div>
          <div
            style={{
              fontSize: 168,
              fontWeight: 800,
              letterSpacing: -8,
              color: dark.textStrong,
              lineHeight: 1,
              opacity: wordmark,
              clipPath: `inset(0 ${(1 - shift) * 100}% 0 0)`,
              transform: `translateX(${(1 - shift) * -40}px)`,
            }}
          >
            Leaf
          </div>
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: dark.muted,
            opacity: tagline,
            transform: `translateY(${(1 - tagline) * 16}px)`,
          }}
        >
          The Notion-style workspace{" "}
          <span style={{ color: dark.textStrong, fontWeight: 700 }}>you can actually own.</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 24,
          color: dark.muted,
          opacity: interpolate(frame, [48, 62], [0, 0.8], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Open source · Runs in your own cloud
      </div>
    </Stage>
  );
};
