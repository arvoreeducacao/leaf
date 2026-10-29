import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Effects, Soundtrack } from "./Sound";
import { AppScene } from "./scenes/AppScene";
import { Hook } from "./scenes/Hook";
import { Outro } from "./scenes/Outro";
import { Peak } from "./scenes/Peak";
import { colors, DURATION_SECONDS } from "./theme";

export const LeafIntro: React.FC = () => {
  const { fps } = useVideoConfig();
  const frames = (from: number, to: number) => ({ from: Math.round(from * fps), durationInFrames: Math.round((to - from) * fps) });

  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <Soundtrack />
      <Effects />
      <Sequence name="Hook" {...frames(0, 5.4)}>
        <Hook />
      </Sequence>
      <Sequence name="Editor" {...frames(4.4, 12.1)}>
        <AppScene
          start={4.4}
          clip="editor"
          trimBefore={0.5}
          rate={1.28}
          enter={{ kind: "circle", at: 4.4, duration: 0.75, cx: 330, cy: 560 }}
          exit={{ kind: "whipOut", at: 11.5, duration: 0.6 }}
          shots={[
            { at: 4.95, duration: 0.8, scale: 1.75, fx: 1000, fy: 450 },
            { at: 6.45, duration: 0.8, scale: 1.8, fx: 1040, fy: 780 },
            { at: 7.55, duration: 0.7, scale: 1.7, fx: 940, fy: 760 },
            { at: 8.55, duration: 0.8, scale: 1.95, fx: 900, fy: 745 },
            { at: 9.9, duration: 0.7, scale: 1.9, fx: 880, fy: 700 },
          ]}
          sticker={{ at: 5.0, until: 11.2, x: 56, y: 56, lead: "Write", accent: "together." }}
        />
      </Sequence>
      <Sequence name="Graph 3D" {...frames(11.5, 16.85)}>
        <AppScene
          start={11.5}
          clip="graph3d"
          trimBefore={1.1}
          rate={1.25}
          enter={{ kind: "whip", at: 11.5, duration: 0.6 }}
          exit={{ kind: "pushUpOut", at: 16.1, duration: 0.6 }}
          settle={{ at: 11.5, duration: 0.85, x: 220, y: 0 }}
          shots={[
            { at: 11.9, duration: 0.8, scale: 1.06, fx: 980, fy: 540 },
            { at: 13.0, duration: 0.9, scale: 1.1, fx: 960, fy: 550 },
            { at: 14.9, duration: 0.8, scale: 1.12, fx: 990, fy: 620 },
          ]}
          sticker={{ at: 12.7, until: 15.9, x: 70, y: 900, lead: "Your pages,", accent: "in 3D.", from: "left" }}
        />
      </Sequence>
      <Sequence name="Search" {...frames(16.1, 19.2)}>
        <AppScene
          start={16.1}
          clip="search"
          trimBefore={0}
          rate={1.16}
          enter={{ kind: "pushUp", at: 16.1, duration: 0.6 }}
          exit={{ kind: "zoomOut", at: 18.45, duration: 0.6 }}
          settle={{ at: 16.1, duration: 0.8, x: 0, y: 160 }}
          shots={[
            { at: 16.7, duration: 0.8, scale: 1.45, fx: 955, fy: 372 },
            { at: 17.9, duration: 0.8, scale: 1.55, fx: 1000, fy: 470 },
          ]}
          sticker={{ at: 16.8, until: 18.8, x: 1060, y: 800, lead: "Find", accent: "anything." }}
        />
      </Sequence>
      <Sequence name="Database" {...frames(18.45, 22.05)}>
        <AppScene
          start={18.45}
          clip="db"
          trimBefore={0.66}
          rate={1.2}
          enter={{ kind: "iris", at: 18.45, duration: 0.6 }}
          shots={[
            { at: 19.0, duration: 0.8, scale: 1.45, fx: 1150, fy: 400 },
            { at: 20.5, duration: 0.8, scale: 1.4, fx: 1060, fy: 560 },
          ]}
          sticker={{ at: 19.5, until: 21.7, x: 70, y: 900, lead: "Group by", accent: "status.", from: "left" }}
        />
      </Sequence>
      <Sequence name="Offline" {...frames(21.35, 24.6)}>
        <AppScene
          start={21.35}
          clip="offline"
          trimBefore={1.0}
          rate={1.15}
          enter={{ kind: "slant", at: 21.35, duration: 0.65 }}
          exit={{ kind: "pushDownOut", at: 24.25, duration: 0.6 }}
          settle={{ at: 21.35, duration: 0.9, x: -140, y: 0 }}
          shots={[
            { at: 21.7, duration: 0.7, scale: 1.8, fx: 1380, fy: 300 },
            { at: 22.6, duration: 0.7, scale: 1.7, fx: 1000, fy: 690 },
            { at: 23.7, duration: 0.65, scale: 1.8, fx: 1380, fy: 300 },
          ]}
          sticker={{ at: 21.9, until: 24.2, x: 70, y: 900, lead: "Works", accent: "offline.", from: "left" }}
        />
      </Sequence>
      <Sequence name="Share" {...frames(24.25, 28.3)}>
        <AppScene
          start={24.25}
          clip="share"
          trimBefore={1.1}
          rate={1.3}
          enter={{ kind: "pushDown", at: 24.25, duration: 0.6 }}
          settle={{ at: 24.25, duration: 0.8, x: 0, y: -160 }}
          shots={[
            { at: 24.85, duration: 0.8, scale: 1.5, fx: 700, fy: 440 },
            { at: 26.0, duration: 0.8, scale: 1.55, fx: 740, fy: 640 },
            { at: 27.15, duration: 0.7, scale: 1.65, fx: 780, fy: 750 },
          ]}
          sticker={{ at: 24.9, until: 27.7, x: 56, y: 56, lead: "Share", accent: "precisely.", from: "left" }}
        />
      </Sequence>
      <Sequence name="One command" {...frames(27.75, 33.8)}>
        <Peak />
      </Sequence>
      <Sequence name="Outro" {...frames(33.1, DURATION_SECONDS)}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
