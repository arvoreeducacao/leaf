import React from "react";
import { interpolate } from "remotion";
import { LeafLogo } from "../LeafLogo";
import { useFadeIn, useSpringAt } from "../motion";
import { brand, dark, fonts } from "../theme";
import { Pill, Stage } from "../ui";

const badges = ["Open source", "Your own cloud", "Real-time collaboration", "Works offline", "English · Português"];

export const Outro: React.FC = () => {
  const logo = useSpringAt(0, { damping: 16, stiffness: 120 });
  const url = useFadeIn(28, 14);
  const cta = useSpringAt(46, { damping: 16, stiffness: 140 });

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
          gap: 36,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28, transform: `scale(${logo})`, opacity: logo }}>
          <LeafLogo size={120} />
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -6, color: dark.textStrong, lineHeight: 1 }}>
            Leaf
          </div>
        </div>
        <div style={{ fontSize: 36, color: dark.muted, opacity: interpolate(logo, [0.5, 1], [0, 1]) }}>
          Your documents. Your people. Your cloud.
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {badges.map((b, i) => {
            const s = useSpringAt(16 + i * 4, { damping: 18, stiffness: 160 });
            return (
              <div key={b} style={{ opacity: s, transform: `translateY(${(1 - s) * 14}px)` }}>
                <Pill color={dark.text} bg={dark.card} style={{ border: `1px solid ${dark.line}`, fontSize: 20 }}>
                  {b}
                </Pill>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 22,
            padding: "18px 38px",
            borderRadius: 14,
            background: brand.primary,
            color: "#fff",
            fontSize: 30,
            fontWeight: 700,
            opacity: cta,
            transform: `scale(${0.9 + cta * 0.1})`,
            boxShadow: "0 20px 60px rgba(39,131,222,0.35)",
          }}
        >
          Your markdown editor.
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 22, color: dark.muted, opacity: url * 0.8 }}>
          github.com/arvoreeducacao/leaf
        </div>
      </div>
    </Stage>
  );
};
