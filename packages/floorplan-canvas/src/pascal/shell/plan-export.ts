/**
 * UAT 6.4: the floor plan as a downloadable picture (PNG or JPEG) or a one-page PDF, drawn from the same SVG the
 * printed plan uses. Rasterising needs a browser; the PDF wrapper is pure so it can be tested.
 */

export type PlanImageType = "image/png" | "image/jpeg";

/** Long side of the exported picture, in pixels: sharp enough to print on A3. */
const EXPORT_LONG_SIDE_PX = 3000;

/** The SVG's drawing size from its viewBox, scaled so the long side is EXPORT_LONG_SIDE_PX. */
export function exportSize(svg: string, longSide = EXPORT_LONG_SIDE_PX): { width: number; height: number } {
  const match = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  const w = match ? Number(match[3]) : 4;
  const h = match ? Number(match[4]) : 3;
  const scale = longSide / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** A standalone SVG at a fixed pixel size on white, ready to draw onto a canvas. */
export function standaloneSvg(svg: string, size: { width: number; height: number }): string {
  return svg
    .replace(/ style="[^"]*"/, ` width="${size.width}" height="${size.height}"`)
    .replace(/(<svg[^>]*>)/, `$1<rect x="-100000" y="-100000" width="200000" height="200000" fill="#ffffff"/>`);
}

/** Draws the plan SVG to a picture in the browser. */
export async function planImage(svg: string, type: PlanImageType): Promise<{ blob: Blob; width: number; height: number }> {
  const size = exportSize(svg);
  const url = URL.createObjectURL(new Blob([standaloneSvg(svg, size)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The floor plan could not be drawn."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot export pictures.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
    if (!blob) throw new Error("The floor plan could not be exported.");
    return { blob, width: size.width, height: size.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const encoder = new TextEncoder();

/**
 * A one-page PDF holding one JPEG, fitted inside an A4 page in the picture's orientation with a 10 mm margin.
 * Written by hand: one image object and one content stream need no PDF library.
 */
export function jpegPdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number): Uint8Array {
  const landscape = imageWidth >= imageHeight;
  const [pageW, pageH] = landscape ? [841.89, 595.28] : [595.28, 841.89];
  const margin = 28.35;
  const scale = Math.min((pageW - 2 * margin) / imageWidth, (pageH - 2 * margin) / imageHeight);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  const fixed = (value: number) => value.toFixed(2);
  const content = `q ${fixed(drawW)} 0 0 ${fixed(drawH)} ${fixed(x)} ${fixed(y)} cm /Im0 Do Q`;

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | Array<string | Uint8Array>) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const piece of Array.isArray(body) ? body : [body]) push(piece);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(pageW)} ${fixed(pageH)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, [`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, "\nendstream"]);
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A file name from the plan title: letters, digits and dashes only. */
export function planFileName(title: string, extension: "png" | "jpg" | "pdf"): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "floor-plan";
  return `${base}.${extension}`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the plan in one of the three formats PMCM and clients share it in. */
export async function downloadPlan(svg: string, title: string, format: "png" | "jpg" | "pdf") {
  if (format === "png") {
    const { blob } = await planImage(svg, "image/png");
    return downloadBlob(blob, planFileName(title, "png"));
  }
  const { blob, width, height } = await planImage(svg, "image/jpeg");
  if (format === "jpg") return downloadBlob(blob, planFileName(title, "jpg"));
  const pdf = jpegPdf(new Uint8Array(await blob.arrayBuffer()), width, height);
  return downloadBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), planFileName(title, "pdf"));
}
