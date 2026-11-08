/**
 * FR-67: reads the text of a Word (.docx) template so PMCM can reuse an existing conforme template.
 * A .docx is a zip; only word/document.xml is read, with the browser's built-in raw-deflate decoder.
 * Placeholders such as {{clientName}} survive even when Word splits them across formatting runs.
 */
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const DOCUMENT_PATH = "word/document.xml";

function findEndOfCentralDirectory(view: DataView): number {
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 22 - 0xffff); offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("This file is not a Word document (.docx).");
}

function findDocumentEntry(bytes: Uint8Array, view: DataView) {
  const eocd = findEndOfCentralDirectory(view);
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name === DOCUMENT_PATH) return { method, compressedSize, localOffset };
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("This Word document has no main body (word/document.xml).");
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/** Paragraphs become lines, tabs and breaks are kept, every other tag is dropped. */
export function documentXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function readDocxText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entry = findDocumentEntry(bytes, view);
  if (view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE) throw new Error("This Word document is damaged.");
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);
  const data = entry.method === 0 ? raw : entry.method === 8 ? await inflateRaw(raw) : null;
  if (!data) throw new Error("This Word document uses an unsupported compression method.");
  const text = documentXmlToText(new TextDecoder().decode(data));
  if (!text) throw new Error("This Word template has no text.");
  return text;
}
