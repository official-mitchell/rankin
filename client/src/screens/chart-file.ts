// Turns chart SVGs into 2000px PNGs in the browser (checklist 11.2).
import fontUrl from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import { leaderboardSvg, pitchCardSvg, pngFileName, type ChartPitch } from "@we-rankin/shared";

export async function loadInterBase64(): Promise<string> {
  const response = await fetch(fontUrl);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 2000;
    canvas.height = Math.max(1, Math.round(2000 * (image.naturalHeight / image.naturalWidth)));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("png");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function chartFiles(pitches: ChartPitch[]): Promise<Array<{ name: string; png: Blob }>> {
  const font = await loadInterBase64();
  const files = [
    { name: "leaderboard.png", svg: leaderboardSvg(pitches, font) },
    ...pitches.map((pitch) => ({ name: pngFileName(pitch.title), svg: pitchCardSvg(pitch, font) })),
  ];
  const pngs: Array<{ name: string; png: Blob }> = [];
  for (const file of files) pngs.push({ name: file.name, png: await svgToPng(file.svg) });
  return pngs;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
