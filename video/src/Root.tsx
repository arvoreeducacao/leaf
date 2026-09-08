import React from "react";
import { Composition } from "remotion";
import { LeafIntro, totalDuration } from "./LeafIntro";
import { FPS, HEIGHT, WIDTH } from "./theme";

export const Root: React.FC = () => (
  <Composition
    id="LeafIntro"
    component={LeafIntro}
    durationInFrames={totalDuration}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
