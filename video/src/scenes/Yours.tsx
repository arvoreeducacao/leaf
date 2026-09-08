import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useSpringAt } from "../motion";
import { brand, dark } from "../theme";
import { Caption, Headline, Stage } from "../ui";

const Card: React.FC<{
  startFrame: number;
  icon: string;
  title: string;
  detail: string;
  wide?: boolean;
  children?: React.ReactNode;
}> = ({ startFrame, icon, title, detail, wide, children }) => {
  const s = useSpringAt(startFrame, { damping: 18, stiffness: 140 });
  return (
    <div
      style={{
        gridColumn: wide ? "1 / -1" : undefined,
        padding: "28px 30px",
        borderRadius: 18,
        background: dark.card,
        border: `1px solid ${dark.line}`,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        display: "flex",
        flexDirection: wide ? "row" : "column",
        alignItems: wide ? "center" : "stretch",
        gap: wide ? 28 : 16,
        minHeight: wide ? 0 : 280,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "rgba(39,131,222,0.16)",
          display: "grid",
          placeItems: "center",
          fontSize: 28,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: dark.textStrong, letterSpacing: -0.5 }}>
          {title}
        </div>
        <div style={{ fontSize: 21, color: dark.muted, lineHeight: 1.45 }}>{detail}</div>
      </div>
      {children}
    </div>
  );
};

const SeatCounter: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const people = Math.round(
    interpolate(frame, [startFrame + 10, startFrame + 70], [12, 2400], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 3),
    }),
  );
  return (
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingTop: 10,
        borderTop: `1px solid ${dark.line}`,
      }}
    >
      <div>
        <div style={{ fontSize: 15, color: dark.muted, letterSpacing: 0.6, fontWeight: 600 }}>
          PEOPLE
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: dark.textStrong,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}
        >
          {people.toLocaleString("en-US")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, color: dark.muted, letterSpacing: 0.6, fontWeight: 600 }}>
          PER-SEAT BILL
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: brand.teal, lineHeight: 1.1 }}>none</div>
      </div>
    </div>
  );
};

export const Yours: React.FC = () => (
  <Stage>
    <Headline size={56} top={64}>
      Your data stays yours.
    </Headline>
    <div
      style={{
        position: "absolute",
        top: 240,
        left: 0,
        right: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3, 520px)",
        gap: 22,
        justifyContent: "center",
      }}
    >
      <Card
        startFrame={6}
        icon="🏢"
        title="Lives in your company's cloud"
        detail="Documents, files and history stay on servers you control. Nothing is sent anywhere else, and nobody is reading along."
      />
      <Card
        startFrame={12}
        icon="👥"
        title="Invite the whole company"
        detail="The bill does not grow with headcount."
      >
        <SeatCounter startFrame={12} />
      </Card>
      <Card
        startFrame={18}
        icon="🚪"
        title="Leave whenever you want"
        detail="Every page exports to Markdown or HTML, with images and links. No lock-in, no exit negotiation."
      />
      <Card
        startFrame={30}
        icon="✦"
        title="AI on your terms"
        detail="Write, continue, summarise, improve, translate. It runs with the AI provider your company already trusts, on your side of the wall."
        wide
      />
    </div>
    <Caption startFrame={44} bottom={64}>
      Open source, so the rules cannot change under you. Two languages, two themes, accessible in
      both.
    </Caption>
  </Stage>
);
