import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { documentXmlToText, readDocxText } from "./docx-template-text";

/** A minimal one-entry zip holding word/document.xml, deflated like Word saves it. */
function docx(xml: string): ArrayBuffer {
  const name = Buffer.from("word/document.xml");
  const data = deflateRawSync(Buffer.from(xml));
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const centralOffset = local.length + name.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(centralOffset, 16);
  const file = Buffer.concat([local, name, data, central, name, eocd]);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("Word conforme templates (FR-67)", () => {
  it("reads paragraphs and keeps placeholders that Word split across runs", async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>CONFORME for {{event</w:t></w:r><w:r><w:t>Name}}</w:t></w:r></w:p><w:p><w:r><w:t>Client: {{clientName}} &amp; team</w:t></w:r></w:p></w:body></w:document>';
    await expect(readDocxText(docx(xml))).resolves.toBe("CONFORME for {{eventName}}\nClient: {{clientName}} & team");
  });

  it("refuses a file that is not a Word document", async () => {
    await expect(readDocxText(new TextEncoder().encode("plain text, not a zip").buffer)).rejects.toThrow("not a Word document");
    expect(documentXmlToText("<w:p></w:p>")).toBe("");
  });
});

describe("Word template text extraction", () => {
  it("keeps only text inside Word text runs, so markup and scripts never reach the conforme", () => {
    const xml = '<w:p><w:r><w:t>Hello &lt;b&gt; {{clientName}}</w:t></w:r><w:bookmarkStart w:name="x"/><script>alert(1)</script></w:p>';
    expect(documentXmlToText(xml)).toBe("Hello <b> {{clientName}}");
  });
});
