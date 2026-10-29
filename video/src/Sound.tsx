import React from "react";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

const musicCurve: ReadonlyArray<readonly [number, number]> = [
  [0, 0.72],
  [4.9, 0.72],
  [5.2, 0.56],
  [27.5, 0.56],
  [27.65, 0.04],
  [28.04, 0.04],
  [28.07, 0.86],
  [33.3, 0.86],
  [33.6, 0.7],
  [37.4, 0.7],
  [39, 0.2],
];

const effects: ReadonlyArray<readonly [string, number, number]> = [
  ["entrada", 1.49, 0.35],
  ["entrada", 2.53, 0.35],
  ["pagina", 3.69, 0.45],
  ["transicao", 4.3, 0.45],
  ["entrada", 5.0, 0.3],
  ["transicao", 11.48, 0.45],
  ["clique", 12.1, 0.4],
  ["entrada", 12.7, 0.3],
  ["transicao", 16.08, 0.45],
  ["entrada", 16.8, 0.3],
  ["clique", 18.34, 0.35],
  ["transicao", 18.43, 0.45],
  ["entrada", 19.5, 0.3],
  ["clique", 20.15, 0.4],
  ["transicao", 21.33, 0.45],
  ["entrada", 21.9, 0.3],
  ["transicao", 24.23, 0.45],
  ["entrada", 24.9, 0.3],
  ["clique", 26.56, 0.4],
  ["clique", 27.8, 0.4],
  ["subida", 27.1, 0.6],
  ["impacto", 28.07, 0.7],
  ["digitacao", 28.75, 0.5],
  ["confirmacao", 31.45, 0.5],
  ["transicao", 33.08, 0.4],
  ["lapis", 33.5, 0.5],
  ["entrada", 35.04, 0.3],
  ["transicao", 36.98, 0.4],
  ["entrada", 37.55, 0.3],
];

const musicAt = (seconds: number) =>
  interpolate(
    seconds,
    musicCurve.map(([at]) => at),
    musicCurve.map(([, volume]) => volume),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

export const Soundtrack: React.FC = () => {
  const { fps } = useVideoConfig();
  return <Audio src={staticFile("audio/trilha.mp3")} volume={(frame) => musicAt(frame / fps)} />;
};

export const Effects: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      {effects.map(([name, at, volume]) => (
        <Audio key={`${name}-${at}`} src={staticFile(`audio/sfx/${name}.mp3`)} from={Math.round(at * fps)} volume={volume} />
      ))}
    </>
  );
};
