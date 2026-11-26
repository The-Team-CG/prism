import { describe, expect, it } from "vitest";
import { exportSize, jpegPdf, planFileName, standaloneSvg } from "./plan-export";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 22 11" style="width:100%;max-height:70vh"><line/></svg>`;

describe("floor plan downloads (UAT 6.4)", () => {
  it("exports the plan at print size, on white, keeping its proportions", () => {
    expect(exportSize(svg)).toEqual({ width: 3000, height: 1500 });
    const standalone = standaloneSvg(svg, { width: 3000, height: 1500 });
    expect(standalone).toContain('width="3000" height="1500"');
    expect(standalone).not.toContain("max-height");
    expect(standalone).toMatch(/<svg[^>]*><rect [^>]*fill="#ffffff"\/><line\/>/);
  });

  it("wraps the JPEG in a readable one-page PDF, landscape for a wide plan", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const pdf = jpegPdf(jpeg, 3000, 1500);
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 841.89 595.28]");
    expect(text).toContain("/Width 3000 /Height 1500");
    expect(text).toContain("/Filter /DCTDecode /Length 7");
    // Every cross-reference offset points at its object.
    const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
    const offsets = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, index) => expect(text.slice(offset, offset + 7)).toBe(`${index + 1} 0 obj`));
    expect(new TextDecoder("latin1").decode(jpegPdf(jpeg, 1000, 2000))).toContain("/MediaBox [0 0 595.28 841.89]");
  });

  it("names the file after the plan", () => {
    expect(planFileName("Ayala Gala — Ballroom", "pdf")).toBe("ayala-gala-ballroom.pdf");
    expect(planFileName("  ", "png")).toBe("floor-plan.png");
  });
});
