import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useFadeIn, useSpringAt, useTyped } from "../motion";
import { brand, light } from "../theme";
import { Caption, Headline, Stage, Window } from "../ui";

const people = [
  { name: "Marina Costa", sub: "marina@acme.com", role: "Can edit", color: "#d9536f", at: 14 },
  { name: "Diego Alves", sub: "diego@acme.com", role: "Can comment", color: "#4f9e8d", at: 20 },
  { name: "Legal teamspace", sub: "14 people", role: "Can view", color: "#d9822b", at: 26, group: true },
];

const GUEST_AT = 40;
const LINK_AT = 82;
const REVOKE_AT = 118;

const RoleChip: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 17,
      color: light.muted,
      padding: "6px 12px",
      borderRadius: 8,
      background: light.subtle,
    }}
  >
    {label}
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={light.muted} strokeWidth={2.2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  </div>
);

const Row: React.FC<{
  startFrame: number;
  avatar: React.ReactNode;
  name: string;
  sub: string;
  role: string;
  badge?: string;
}> = ({ startFrame, avatar, name, sub, role, badge }) => {
  const s = useSpringAt(startFrame, { damping: 18, stiffness: 160 });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 6px",
        opacity: s,
        transform: `translateX(${(1 - s) * -14}px)`,
      }}
    >
      {avatar}
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, color: light.text, display: "flex", gap: 10, alignItems: "center" }}>
          {name}
          {badge && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: brand.primaryDark,
                background: "#e7f3f8",
                padding: "2px 8px",
                borderRadius: 6,
                letterSpacing: 0.4,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 16, color: light.muted }}>{sub}</div>
      </div>
      <RoleChip label={role} />
    </div>
  );
};

const Avatar: React.FC<{ color: string; initials: string }> = ({ color, initials }) => (
  <div
    style={{
      width: 42,
      height: 42,
      borderRadius: 999,
      background: color,
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontSize: 16,
      fontWeight: 700,
      flexShrink: 0,
    }}
  >
    {initials}
  </div>
);

export const Share: React.FC = () => {
  const frame = useCurrentFrame();
  const guestTyped = useTyped("carla@partner.co", GUEST_AT - 30, 0.75);
  const guestAdded = frame >= GUEST_AT;
  const linkOn = useSpringAt(LINK_AT, { damping: 14, stiffness: 220 });
  const linkRow = useFadeIn(LINK_AT + 4, 10);
  const revoked = frame >= REVOKE_AT;
  const linkOff = useSpringAt(REVOKE_AT, { damping: 14, stiffness: 220 });
  const linkState = revoked ? 1 - linkOff : linkOn;

  return (
    <Stage>
      <Headline size={56} top={64}>
        Share with exactly the right people.
      </Headline>
      <Window width={1240} height={620} background="#fff" startFrame={2} top={210}>
        <div style={{ padding: "26px 40px 0", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 30 }}>🗓️</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: light.text, letterSpacing: -0.5 }}>
            Q4 planning
          </span>
          <div
            style={{
              marginLeft: "auto",
              padding: "10px 20px",
              borderRadius: 10,
              background: brand.primary,
              color: "#fff",
              fontSize: 19,
              fontWeight: 600,
            }}
          >
            Share
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 92,
            width: 640,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 24px 70px rgba(0,0,0,0.18), 0 0 0 1px rgba(55,53,47,0.1)",
            padding: "18px 20px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1.5px solid ${guestTyped.started && !guestAdded ? brand.primary : light.line}`,
              fontSize: 19,
              color: guestTyped.text ? light.text : light.muted,
              minHeight: 48,
            }}
          >
            {guestAdded ? "Invite by name or email…" : guestTyped.text || "Invite by name or email…"}
            {!guestAdded && guestTyped.started && (
              <span style={{ color: brand.primary }}>|</span>
            )}
            <div
              style={{
                marginLeft: "auto",
                padding: "6px 14px",
                borderRadius: 8,
                background: guestTyped.done && !guestAdded ? brand.primary : light.subtle,
                color: guestTyped.done && !guestAdded ? "#fff" : light.muted,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Invite
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
            {people.map((p) => (
              <Row
                key={p.name}
                startFrame={p.at}
                avatar={
                  p.group ? (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: "#fbeee0",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 20,
                      }}
                    >
                      ⚖️
                    </div>
                  ) : (
                    <Avatar color={p.color} initials={p.name.split(" ").map((w) => w[0]).join("")} />
                  )
                }
                name={p.name}
                sub={p.sub}
                role={p.role}
              />
            ))}
            {guestAdded && (
              <Row
                startFrame={GUEST_AT}
                avatar={<Avatar color="#6b5bd2" initials="C" />}
                name="Carla"
                sub="carla@partner.co · outside your company"
                role="Can comment"
                badge="GUEST"
              />
            )}
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 16,
              borderTop: `1px solid ${light.line}`,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: light.subtle,
                display: "grid",
                placeItems: "center",
                fontSize: 20,
              }}
            >
              🌐
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: light.text }}>Public link</div>
              <div style={{ fontSize: 16, color: revoked ? brand.rose : light.muted, opacity: revoked ? 1 : linkRow }}>
                {revoked ? "Link revoked. It stops working immediately." : "Anyone with the link can view"}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                width: 58,
                height: 32,
                borderRadius: 999,
                background: `rgba(39,131,222,${0.18 + linkState * 0.82})`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3 + linkState * 26,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 40, top: 110, width: 480, color: light.muted, fontSize: 19, lineHeight: 1.6 }}>
          <div style={{ width: 380, height: 14, borderRadius: 7, background: light.subtle, marginBottom: 14 }} />
          <div style={{ width: 440, height: 14, borderRadius: 7, background: light.subtle, marginBottom: 14 }} />
          <div style={{ width: 300, height: 14, borderRadius: 7, background: light.subtle, marginBottom: 34 }} />
          <div style={{ width: 420, height: 14, borderRadius: 7, background: light.subtle, marginBottom: 14 }} />
          <div style={{ width: 360, height: 14, borderRadius: 7, background: light.subtle }} />
          <div
            style={{
              marginTop: 40,
              opacity: interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {["Open teamspaces anyone can join", "Closed ones by invitation", "A role per document"].map((t) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "center", color: light.text }}>
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={brand.teal} strokeWidth={3}>
                  <path d="M5 12l4.5 4.5L19 7" />
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </Window>
      <Caption startFrame={50} bottom={56}>
        Teamspaces open or closed, a role per document, guests from outside, and public links you can
        switch off at any time.
      </Caption>
    </Stage>
  );
};
