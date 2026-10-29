import { HEIGHT, WIDTH } from "./theme";
import { powerInOut, ramp } from "./anim";

export type Pose = Readonly<{ scale: number; fx: number; fy: number }>;
export type Shot = Pose & Readonly<{ at: number; duration: number }>;

const wide: Pose = { scale: 1, fx: WIDTH / 2, fy: HEIGHT / 2 };

export const cameraAt = (t: number, shots: ReadonlyArray<Shot>): Pose => {
  let current = wide;
  for (const shot of shots) {
    if (t >= shot.at + shot.duration) {
      current = shot;
      continue;
    }
    if (t > shot.at) {
      const p = ramp(t, shot.at, shot.at + shot.duration, 0, 1, powerInOut(2));
      return {
        scale: current.scale + (shot.scale - current.scale) * p,
        fx: current.fx + (shot.fx - current.fx) * p,
        fy: current.fy + (shot.fy - current.fy) * p,
      };
    }
    break;
  }
  return current;
};

export const cameraStyle = ({ scale, fx, fy }: Pose) => ({
  translate: `${-scale * (fx - WIDTH / 2)}px ${-scale * (fy - HEIGHT / 2)}px`,
  scale,
});
