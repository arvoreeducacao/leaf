import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useFadeIn, useSpringAt } from "../motion";
import { brand, dark, fonts, light } from "../theme";
import { Caption, Headline, Stage } from "../ui";

const tree = [
  { label: "Company wiki", depth: 0, icon: "🏠" },
  { label: "Engineering", depth: 1, icon: "⚙️" },
  { label: "Architecture notes", depth: 2, icon: "📄" },
  { label: "Runbooks", depth: 2, icon: "📄" },
  { label: "Product", depth: 1, icon: "🧭" },
  { label: "Roadmap 2026", depth: 2, icon: "🗓️" },
  { label: "Customer interviews", depth: 2, icon: "🗂️", db: true },
  { label: "People", depth: 1, icon: "🧑‍🤝‍🧑" },
  { label: "Onboarding checklist", depth: 2, icon: "☑️" },
];

const converted = [
  { label: "pages", value: 128 },
  { label: "databases", value: 12 },
  { label: "images", value: 340 },
  { label: "internal links", value: 1204 },
];

export const Import: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = useSpringAt(6, { damping: 12, stiffness: 80, mass: 1.2 });
  const landed = frame >= 34;
  const zipY = interpolate(drop, [0, 1], [-420, 0]);
  const squash = landed ? 1 : 1;
  const burst = useSpringAt(34, { damping: 16, stiffness: 120 });
  const zipOpacity = interpolate(frame, [34, 46], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage>
      <Headline size={56} top={64} startFrame={0}>
        Your Notion comes with you.
      </Headline>
      <div
        style={{
          position: "absolute",
          top: 210,
          left: 0,
          right: 0,
          bottom: 150,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 120,
        }}
      >
        <div style={{ position: "relative", width: 420, height: 560 }}>
          <div
            style={{
              position: "absolute",
              left: 60,
              top: 180,
              width: 300,
              padding: "26px 30px",
              borderRadius: 16,
              background: dark.card,
              border: `1px solid ${dark.line}`,
              display: "flex",
              alignItems: "center",
              gap: 18,
              transform: `translateY(${zipY}px) scaleY(${squash})`,
              opacity: zipOpacity,
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 68,
                borderRadius: 8,
                background: "linear-gradient(180deg,#3a3a3a,#2a2a2a)",
                border: `1px solid ${dark.line}`,
                display: "grid",
                placeItems: "center",
                fontFamily: fonts.mono,
                fontSize: 13,
                color: dark.muted,
              }}
            >
              ZIP
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, color: dark.textStrong }}>
                notion-export.zip
              </div>
              <div style={{ fontSize: 17, color: dark.muted, marginTop: 4 }}>2.4 GB</div>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 120,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              opacity: burst,
              transform: `scale(${0.9 + burst * 0.1})`,
            }}
          >
            {converted.map((c, i) => {
              const s = useSpringAt(38 + i * 6, { damping: 18, stiffness: 140 });
              const n = Math.round(
                interpolate(frame, [38 + i * 6, 74 + i * 6], [0, c.value], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              );
              return (
                <div
                  key={c.label}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    padding: "14px 24px",
                    borderRadius: 12,
                    background: dark.card,
                    border: `1px solid ${dark.line}`,
                    opacity: s,
                    transform: `translateX(${(1 - s) * -30}px)`,
                  }}
                >
                  <span style={{ fontSize: 20, color: dark.muted }}>{c.label}</span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: dark.textStrong,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {n.toLocaleString("en-US")}
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: 18, color: brand.primaryLight, paddingLeft: 6, marginTop: 6 }}>
              converted, links rewritten, callouts kept
            </div>
          </div>
        </div>
        <svg width={120} height={60} viewBox="0 0 120 60" style={{ opacity: burst }}>
          <path
            d="M4 30h96"
            stroke={brand.primary}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={100}
            strokeDashoffset={(1 - burst) * 100}
          />
          <path
            d="M80 12l24 18-24 18"
            fill="none"
            stroke={brand.primary}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={burst}
          />
        </svg>
        <div
          style={{
            width: 560,
            height: 560,
            borderRadius: 18,
            background: "#fff",
            boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            opacity: burst,
            transform: `translateY(${(1 - burst) * 40}px)`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: light.muted, letterSpacing: 0.6 }}>
            IMPORTED · JUST NOW
          </div>
          {tree.map((t, i) => {
            const s = useSpringAt(46 + i * 5, { damping: 18, stiffness: 160 });
            return (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 12px",
                  paddingLeft: 12 + t.depth * 30,
                  borderRadius: 8,
                  fontSize: 22,
                  color: light.text,
                  fontWeight: t.depth === 0 ? 700 : 500,
                  opacity: s,
                  transform: `translateX(${(1 - s) * -16}px)`,
                }}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                {t.label}
                {t.db && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 13,
                      fontWeight: 600,
                      color: brand.primaryDark,
                      background: "#e7f3f8",
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    DATABASE
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Caption startFrame={50} bottom={60}>
        Drop a Notion export zip, or connect your account and import by link. Markdown files work
        too.
      </Caption>
    </Stage>
  );
};
