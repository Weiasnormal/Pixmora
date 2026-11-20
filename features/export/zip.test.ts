import { describe, expect, it } from "vitest";
import { crc32, createZip } from "./zip";

const text = (value: string) => new TextEncoder().encode(value);

/** Reads a stored ZIP back through its central directory, the way unzip tools do. */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const endAt = zip.length - 22;
  expect(view.getUint32(endAt, true)).toBe(0x06054b50);
  const count = view.getUint16(endAt + 10, true);
  let at = view.getUint32(endAt + 16, true);
  const files: { name: string; bytes: Uint8Array; crc: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const localAt = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(localAt, true)).toBe(0x04034b50);
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true);
    files.push({ name, crc, bytes: zip.slice(dataAt, dataAt + size) });
    at += 46 + nameLength;
  }
  return files;
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
  });
});

describe("createZip", () => {
  it("stores every file so it can be read back intact", () => {
    const entries = [
      { name: "pixmora-sheet-1-300dpi.png", bytes: text("first sheet") },
      { name: "pixmora-sheet-2-300dpi.png", bytes: new Uint8Array([0, 255, 137, 80, 78, 71]) },
    ];
    const files = readZip(createZip(entries, new Date(2026, 10, 13, 9, 30)));
    expect(files.map((f) => f.name)).toEqual(entries.map((e) => e.name));
    files.forEach((file, index) => {
      expect(file.bytes).toEqual(entries[index].bytes);
      expect(file.crc).toBe(crc32(entries[index].bytes));
    });
  });

  it("makes a valid empty archive", () => {
    expect(createZip([])).toHaveLength(22);
  });
});
