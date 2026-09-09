import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const fonts = {
  ui: inter.fontFamily,
  mono: mono.fontFamily,
};

export const dark = {
  bg: "#191919",
  nav: "#202020",
  card: "#252525",
  subtle: "#2f2f2f",
  text: "#d4d4d4",
  textStrong: "#ffffff",
  muted: "#9b9b9b",
  line: "rgba(255,255,255,0.094)",
};

export const light = {
  bg: "#ffffff",
  nav: "#f9f8f7",
  subtle: "#f1f1ef",
  text: "#2c2c2b",
  muted: "#5f5e59",
  line: "rgba(55,53,47,0.09)",
};

export const brand = {
  primary: "#2783de",
  primaryLight: "#6cb6e4",
  primaryDark: "#1665b0",
  teal: "#4f9e8d",
  amber: "#d9822b",
  rose: "#d9536f",
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
