import React from "react";
import { springTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { Editor } from "./scenes/Editor";
import { Import } from "./scenes/Import";
import { Intro } from "./scenes/Intro";
import { Offline } from "./scenes/Offline";
import { Outro } from "./scenes/Outro";
import { Share } from "./scenes/Share";
import { Yours } from "./scenes/Yours";

export const TRANSITION = 16;

export const scenes = [
  { id: "intro", Component: Intro, duration: 84 },
  { id: "editor", Component: Editor, duration: 215 },
  { id: "import", Component: Import, duration: 118 },
  { id: "offline", Component: Offline, duration: 158 },
  { id: "yours", Component: Yours, duration: 124 },
  { id: "share", Component: Share, duration: 150 },
  { id: "outro", Component: Outro, duration: 96 },
];

export const totalDuration =
  scenes.reduce((sum, s) => sum + s.duration, 0) - (scenes.length - 1) * TRANSITION;

export const LeafIntro: React.FC = () => (
  <TransitionSeries>
    {scenes.map((s, i) => (
      <React.Fragment key={s.id}>
        <TransitionSeries.Sequence durationInFrames={s.duration}>
          <s.Component />
        </TransitionSeries.Sequence>
        {i < scenes.length - 1 && (
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
          />
        )}
      </React.Fragment>
    ))}
  </TransitionSeries>
);
