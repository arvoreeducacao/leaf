import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useCaret, useSpringAt, useTyped } from "../motion";
import { brand, dark, light } from "../theme";
import { Caption, Headline, Pill, Stage, Window } from "../ui";

const OFFLINE_AT = 34;
const ONLINE_AT = 118;
const SYNCED_AT = 134;

const WifiIcon: React.FC<{ off: boolean; color: string }> = ({ off, color }) => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <path d="M2 8.5a15 15 0 0 1 20 0" />
    <path d="M5.5 12a10 10 0 0 1 13 0" />
    <path d="M9 15.5a5 5 0 0 1 6 0" />
    <circle cx="12" cy="19" r="1" fill={color} />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

export const Offline: React.FC = () => {
  const frame = useCurrentFrame();
  const caret = useCaret();
  const typed = useTyped(
    "The train went into the tunnel somewhere around here, and nothing changed. Every keystroke lands in the browser first, in an outbox that drains itself the moment the network is back.",
    14,
    1.15,
  );
  const offline = frame >= OFFLINE_AT && frame < ONLINE_AT;
  const syncing = frame >= ONLINE_AT && frame < SYNCED_AT;
  const pending = offline
    ? Math.min(9, Math.floor((frame - OFFLINE_AT) / 9) + 1)
    : syncing
      ? Math.max(0, 9 - Math.floor((frame - ONLINE_AT) / 2))
      : 0;
  const pulse = useSpringAt(OFFLINE_AT, { damping: 10, stiffness: 200 });
  const pulse2 = useSpringAt(SYNCED_AT, { damping: 10, stiffness: 200 });
  const bump = offline ? 1 + (1 - pulse) * 0.12 : frame >= SYNCED_AT ? 1 + (1 - pulse2) * 0.12 : 1;

  const status = offline
    ? { label: `Offline · ${pending} pending`, color: brand.amber, bg: "rgba(217,130,43,0.14)" }
    : syncing
      ? { label: `Syncing · ${pending} left`, color: brand.primary, bg: "rgba(39,131,222,0.14)" }
      : frame >= SYNCED_AT
        ? { label: "Synced", color: brand.teal, bg: "rgba(79,158,141,0.16)" }
        : { label: "Online", color: brand.teal, bg: "rgba(79,158,141,0.16)" };

  const shake = offline
    ? Math.sin((frame - OFFLINE_AT) * 2.2) * Math.max(0, 6 - (frame - OFFLINE_AT) * 0.6)
    : 0;

  return (
    <Stage>
      <Headline size={56} top={64}>
        It keeps working when the network does not.
      </Headline>
      <Window width={1240} height={620} background="#fff" startFrame={2} top={210}>
        <div
          style={{
            position: "absolute",
            top: 22,
            right: 26,
            transform: `scale(${bump}) translateX(${shake}px)`,
          }}
        >
          <Pill color={status.color} bg={status.bg} style={{ fontSize: 19 }}>
            <WifiIcon off={offline} color={status.color} />
            {status.label}
          </Pill>
        </div>
        <div style={{ padding: "70px 120px 0" }}>
          <div style={{ fontSize: 17, color: light.muted }}>Engineering / Field notes</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: light.text, letterSpacing: -1, marginTop: 14 }}>
            Notes from the 7:40 to Campinas
          </div>
          <div style={{ fontSize: 25, lineHeight: 1.6, color: light.text, marginTop: 26, minHeight: 200 }}>
            {typed.text}
            {!typed.done && caret && <span style={{ color: brand.primary }}>|</span>}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 120,
            right: 120,
            bottom: 34,
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontSize: 16,
            color: light.muted,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const filled = i < pending;
            return (
              <div
                key={i}
                style={{
                  width: 34,
                  height: 8,
                  borderRadius: 4,
                  background: filled
                    ? offline
                      ? brand.amber
                      : brand.primary
                    : "rgba(55,53,47,0.1)",
                }}
              />
            );
          })}
          <span style={{ marginLeft: 12 }}>
            {offline
              ? "changes stored locally"
              : syncing
                ? "draining outbox"
                : frame >= SYNCED_AT
                  ? "everything on the server"
                  : "live"}
          </span>
        </div>
      </Window>
      <Caption startFrame={48} bottom={56}>
        Not a spinner, not a read-only mode: you keep writing. Install it as an app on desktop,
        Android and iPhone.
      </Caption>
    </Stage>
  );
};
