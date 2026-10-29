import React from "react";
import { Composition } from "remotion";
import { LeafIntro } from "./LeafIntro";
import { DURATION_SECONDS, FPS, HEIGHT, WIDTH } from "./theme";

export const Root: React.FC = () => (
  <Composition
    id="LeafIntro"
    component={LeafIntro}
    durationInFrames={Math.round(DURATION_SECONDS * FPS)}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
