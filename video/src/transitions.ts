import type { CSSProperties } from "react";
import { HEIGHT, WIDTH } from "./theme";
import { power, powerIn, powerInOut, ramp } from "./anim";

export type Enter =
  | Readonly<{ kind: "circle"; at: number; duration: number; cx: number; cy: number }>
  | Readonly<{ kind: "whip" | "pushUp" | "pushDown" | "iris" | "slant" | "wipeRight"; at: number; duration: number }>;

export type Exit = Readonly<{ kind: "whipOut" | "pushUpOut" | "pushDownOut" | "zoomOut"; at: number; duration: number }>;

const enterStyle = (t: number, enter: Enter): CSSProperties => {
  const p = ramp(t, enter.at, enter.at + enter.duration, 0, 1, powerInOut(enter.kind === "circle" ? 3 : 4));
  switch (enter.kind) {
    case "circle":
      return { clipPath: `circle(${2300 * p}px at ${enter.cx}px ${enter.cy}px)` };
    case "whip":
      return { translate: `${WIDTH * (1 - p)}px 0px` };
    case "pushUp":
      return { translate: `0px ${HEIGHT * (1 - p)}px` };
    case "pushDown":
      return { translate: `0px ${-HEIGHT * (1 - p)}px` };
    case "iris":
      return { clipPath: `inset(${50 * (1 - p)}% ${50 * (1 - p)}% ${50 * (1 - p)}% ${50 * (1 - p)}% round ${40 * (1 - p)}px)` };
    case "slant":
      return {
        clipPath: `polygon(0px 0px, ${2280 * p}px 0px, ${-360 + 2280 * p}px ${HEIGHT}px, 0px ${HEIGHT}px)`,
      };
    case "wipeRight":
      return { clipPath: `inset(0px 0px 0px ${WIDTH * (1 - p)}px)` };
  }
};

const exitStyle = (t: number, exit: Exit): CSSProperties => {
  const p = ramp(t, exit.at, exit.at + exit.duration, 0, 1, exit.kind === "zoomOut" ? powerIn(3) : powerInOut(4));
  switch (exit.kind) {
    case "whipOut":
      return { translate: `${-WIDTH * p}px 0px` };
    case "pushUpOut":
      return { translate: `0px ${-380 * p}px` };
    case "pushDownOut":
      return { translate: `0px ${380 * p}px` };
    case "zoomOut":
      return { scale: 1 + 0.12 * p };
  }
};

export const shellStyle = (t: number, enter?: Enter, exit?: Exit): CSSProperties => ({
  ...(enter ? enterStyle(t, enter) : {}),
  ...(exit ? exitStyle(t, exit) : {}),
});

export const arrive = (t: number, at: number, duration: number, x: number, y: number) => ({
  translate: `${ramp(t, at, at + duration, x, 0, power(3))}px ${ramp(t, at, at + duration, y, 0, power(3))}px`,
});
