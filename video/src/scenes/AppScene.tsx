import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { cameraAt, cameraStyle, type Shot } from "../camera";
import { arrive, shellStyle, type Enter, type Exit } from "../transitions";
import { Pill } from "../Pill";
import { HEIGHT, WIDTH } from "../theme";

type Sticker = Readonly<{ at: number; until: number; x: number; y: number; lead: string; accent: string; from?: "left" | "bottom" }>;

type Props = Readonly<{
  start: number;
  clip: string;
  trimBefore: number;
  rate: number;
  shots: ReadonlyArray<Shot>;
  sticker: Sticker;
  enter?: Enter;
  exit?: Exit;
  settle?: Readonly<{ at: number; duration: number; x: number; y: number }>;
}>;

export const AppScene: React.FC<Props> = ({ start, clip, trimBefore, rate, shots, sticker, enter, exit, settle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = start + frame / fps;

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...shellStyle(t, enter, exit) }}>
      <AbsoluteFill style={settle ? arrive(t, settle.at, settle.duration, settle.x, settle.y) : undefined}>
        <AbsoluteFill style={{ ...cameraStyle(cameraAt(t, shots)), transformOrigin: "50% 50%" }}>
          <Video
            src={staticFile(`clips/${clip}.mp4`)}
            trimBefore={Math.round(trimBefore * fps)}
            playbackRate={rate}
            muted
            objectFit="cover"
            style={{ width: WIDTH, height: HEIGHT }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
      <Pill t={t} {...sticker} />
    </AbsoluteFill>
  );
};
