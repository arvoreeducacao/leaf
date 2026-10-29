import { Easing, interpolate } from "remotion";

export const power = (degree: number) => Easing.out(Easing.poly(degree));
export const powerIn = (degree: number) => Easing.in(Easing.poly(degree));
export const powerInOut = (degree: number) => Easing.inOut(Easing.poly(degree));
export const backOut = (overshoot = 1.7) => Easing.out(Easing.back(overshoot));

export const ramp = (
  t: number,
  from: number,
  to: number,
  start: number,
  end: number,
  easing: (input: number) => number = power(3),
) =>
  interpolate(t, [from, to], [start, end], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const pop = (t: number, at: number, duration: number, easing = power(4)) => ramp(t, at, at + duration, 0, 1, easing);
