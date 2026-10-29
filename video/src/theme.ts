import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const fonts = {
  ui: inter.fontFamily,
  mono: mono.fontFamily,
};

export const colors = {
  ink: "#0b1320",
  blue: "#2383e2",
  mute: "#6b7a8c",
  paper: "#f9f8f7",
  sky: "#7bb8ff",
  green: "#62d6a1",
};

export const FPS = 240;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_SECONDS = 39;
