import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { LeafGlyph } from "../LeafLogo";
import { useCaret, useFadeIn, useSpringAt, useTyped } from "../motion";
import { brand, light } from "../theme";
import { Caption, Headline, Stage, Window } from "../ui";

const W = 1500;
const H = 760;

const pages = [
  { label: "Getting started", depth: 0, icon: "👋" },
  { label: "Product", depth: 0, icon: "🧭" },
  { label: "Roadmap", depth: 1, icon: "🗺️" },
  { label: "Launch plan", depth: 1, icon: "🚀", active: true },
  { label: "Engineering", depth: 0, icon: "⚙️" },
  { label: "Onboarding", depth: 1, icon: "📘" },
  { label: "Hiring", depth: 0, icon: "🧑‍💻" },
];

const Sidebar: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 300,
        height: "100%",
        background: light.nav,
        borderRight: `1px solid ${light.line}`,
        padding: "20px 12px",
        fontSize: 20,
        color: light.muted,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px",
          fontWeight: 600,
          color: light.text,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: brand.primary,
            display: "grid",
            placeItems: "center",
          }}
        >
          <LeafGlyph size={16} color="#fff" />
        </div>
        Acme Workspace
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, padding: "0 10px 6px", letterSpacing: 0.6 }}>
        TEAMSPACES
      </div>
      {pages.map((p, i) => {
        const o = interpolate(frame, [6 + i * 3, 14 + i * 3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={p.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px",
              paddingLeft: 10 + p.depth * 22,
              borderRadius: 6,
              background: p.active ? "rgba(55,53,47,0.08)" : "transparent",
              color: p.active ? light.text : light.muted,
              fontWeight: p.active ? 600 : 500,
              opacity: o,
              transform: `translateX(${(1 - o) * -10}px)`,
            }}
          >
            <span style={{ fontSize: 18 }}>{p.icon}</span>
            {p.label}
          </div>
        );
      })}
    </div>
  );
};

const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <div
    style={{
      width: 22,
      height: 22,
      borderRadius: 5,
      border: `2px solid ${checked ? brand.primary : "rgba(55,53,47,0.35)"}`,
      background: checked ? brand.primary : "transparent",
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
    }}
  >
    {checked && (
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#fff" strokeWidth={3.2}>
        <path d="M5 12l4.5 4.5L19 7" />
      </svg>
    )}
  </div>
);

const Block: React.FC<{ startFrame: number; children: React.ReactNode }> = ({
  startFrame,
  children,
}) => {
  const s = useSpringAt(startFrame, { damping: 20, stiffness: 160 });
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * 12}px)` }}>{children}</div>
  );
};

const slashItems = [
  { icon: "H", label: "Heading 2", hint: "Medium section heading" },
  { icon: "☑", label: "To-do list", hint: "Track tasks with checkboxes" },
  { icon: "▦", label: "Table", hint: "Rows and columns" },
  { icon: "💡", label: "Callout", hint: "Make a note stand out" },
];

const SlashMenu: React.FC<{ startFrame: number; selectedAt: number }> = ({
  startFrame,
  selectedAt,
}) => {
  const frame = useCurrentFrame();
  const s = useSpringAt(startFrame, { damping: 22, stiffness: 220 });
  const highlight = frame < selectedAt ? Math.min(3, Math.floor((frame - startFrame) / 7)) : 3;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 44,
        width: 380,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(55,53,47,0.1)",
        padding: 8,
        opacity: s,
        transform: `translateY(${(1 - s) * -8}px) scale(${0.96 + s * 0.04})`,
        transformOrigin: "top left",
        zIndex: 5,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: light.muted, padding: "6px 10px" }}>
        BASIC BLOCKS
      </div>
      {slashItems.map((it, i) => (
        <div
          key={it.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 10px",
            borderRadius: 6,
            background: i === highlight ? light.subtle : "transparent",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              border: `1px solid ${light.line}`,
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              fontWeight: 700,
              color: light.text,
              background: "#fff",
            }}
          >
            {it.icon}
          </div>
          <div>
            <div style={{ fontSize: 18, color: light.text, fontWeight: 500 }}>{it.label}</div>
            <div style={{ fontSize: 14, color: light.muted }}>{it.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const RemoteCursor: React.FC<{
  name: string;
  color: string;
  path: Array<[number, number, number]>;
}> = ({ name, color, path }) => {
  const frame = useCurrentFrame();
  const xs = path.map((p) => p[0]);
  const ys = path.map((p) => p[1]);
  const ts = path.map((p) => p[2]);
  const x = interpolate(frame, ts, xs, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, ts, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = useFadeIn(ts[0], 10);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: o, zIndex: 6 }}>
      <svg viewBox="0 0 24 24" width={26} height={26}>
        <path
          d="M4 3l7.5 17 2.5-7 7-2.5z"
          fill={color}
          stroke="#fff"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 20,
          background: color,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          padding: "3px 8px",
          borderRadius: 6,
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </div>
    </div>
  );
};

export const Editor: React.FC = () => {
  const frame = useCurrentFrame();
  const caret = useCaret();
  const title = useTyped("Launch plan", 18, 0.7);
  const intro = useTyped(
    "Everything we need to ship Leaf 1.0 to Product Hunt on Tuesday.",
    40,
    1.4,
  );
  const todos = [
    { text: "Record the intro video", at: 78, doneAt: 118 },
    { text: "Write the launch post", at: 86, doneAt: 130 },
    { text: "Warm up the community", at: 94, doneAt: 999 },
  ];
  const slashStart = 112;
  const slash = useTyped("/", slashStart, 1);
  const selectAt = slashStart + 34;
  const calloutIn = selectAt + 4;
  const callout = useTyped(
    "Reminder: comments are anchored to blocks, so leave feedback right here.",
    calloutIn + 6,
    1.6,
  );

  return (
    <Stage>
      <Headline size={56} top={64}>
        A real editor. Not a markdown box.
      </Headline>
      <Window width={W} height={H} background="#fff" startFrame={4} top={190}>
        <div style={{ display: "flex", height: "100%" }}>
          <Sidebar />
          <div style={{ flex: 1, position: "relative", padding: "28px 120px" }}>
            <div style={{ fontSize: 17, color: light.muted, display: "flex", gap: 8 }}>
              <span>Product</span>
              <span>/</span>
              <span style={{ color: light.text }}>Launch plan</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                {["#d9536f", "#4f9e8d", "#d9822b"].map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: c,
                      border: "2px solid #fff",
                      marginLeft: i ? -10 : 0,
                    }}
                  />
                ))}
                <span style={{ marginLeft: 10, fontSize: 15 }}>3 editing</span>
              </div>
            </div>
            <div style={{ fontSize: 44, marginTop: 40 }}>🚀</div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: light.text,
                letterSpacing: -1,
                marginTop: 8,
                minHeight: 60,
              }}
            >
              {title.text}
              {!title.done && title.started && caret && (
                <span style={{ color: brand.primary }}>|</span>
              )}
            </div>
            <div
              style={{
                marginTop: 24,
                fontSize: 22,
                lineHeight: 1.55,
                color: light.text,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ minHeight: 34 }}>
                {intro.text}
                {intro.started && !intro.done && caret && (
                  <span style={{ color: brand.primary }}>|</span>
                )}
              </div>
              <Block startFrame={70}>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>This week</div>
              </Block>
              {todos.map((t) => (
                <Block key={t.text} startFrame={t.at}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Checkbox checked={frame >= t.doneAt} />
                    <span
                      style={{
                        textDecoration: frame >= t.doneAt ? "line-through" : "none",
                        color: frame >= t.doneAt ? light.muted : light.text,
                      }}
                    >
                      {t.text}
                    </span>
                  </div>
                </Block>
              ))}
              <div style={{ position: "relative", minHeight: 40 }}>
                {frame < calloutIn ? (
                  <>
                    <span style={{ color: light.text }}>{slash.text}</span>
                    {slash.started && caret && <span style={{ color: brand.primary }}>|</span>}
                    {slash.done && frame < calloutIn && (
                      <SlashMenu startFrame={slashStart + 4} selectedAt={selectAt} />
                    )}
                  </>
                ) : (
                  <Block startFrame={calloutIn}>
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        background: "#e7f3f8",
                        borderRadius: 8,
                        padding: "14px 18px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ fontSize: 24 }}>💡</span>
                      <span style={{ minHeight: 34 }}>
                        {callout.text}
                        {!callout.done && caret && (
                          <span style={{ color: brand.primary }}>|</span>
                        )}
                      </span>
                    </div>
                  </Block>
                )}
              </div>
            </div>
            <RemoteCursor
              name="Ana"
              color="#d9536f"
              path={[
                [980, 520, 30],
                [760, 330, 60],
                [640, 372, 85],
                [700, 420, 130],
                [520, 470, 175],
              ]}
            />
            <RemoteCursor
              name="Rafa"
              color="#4f9e8d"
              path={[
                [200, 640, 60],
                [420, 500, 95],
                [560, 520, 130],
                [900, 300, 170],
              ]}
            />
          </div>
        </div>
      </Window>
      <Caption startFrame={40} bottom={44}>
        Everything you are used to: slash menu, tables, embeds, comments on blocks, version
        history. Paste from Notion and the formatting survives.
      </Caption>
    </Stage>
  );
};
