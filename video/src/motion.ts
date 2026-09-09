import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const useSpringAt = (
  startFrame: number,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8, ...config },
  });
};

export const useFadeIn = (startFrame: number, durationFrames = 12) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const useTyped = (text: string, startFrame: number, charsPerFrame = 0.9) => {
  const frame = useCurrentFrame();
  const count = Math.max(0, Math.floor((frame - startFrame) * charsPerFrame));
  return {
    text: text.slice(0, Math.min(text.length, count)),
    done: count >= text.length,
    started: frame >= startFrame,
  };
};

export const useCaret = (period = 16) => {
  const frame = useCurrentFrame();
  return frame % period < period / 2;
};
