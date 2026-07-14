export type ZipEntry = Readonly<{
  name: string;
  data: string | Uint8Array;
}>;

const LOCAL_FILE_HEADER_SIZE = 30;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;
const UTF8_FILENAME_FLAG = 0x0800;
const STORE_COMPRESSION_METHOD = 0;
const ZIP_VERSION = 20;

const crc32Table = new Uint32Array(256);

for (let index = 0; index < crc32Table.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0
      ? 0xedb88320 ^ (value >>> 1)
      : value >>> 1;
  }
  crc32Table[index] = value >>> 0;
}

function crc32(data: Uint8Array) {
  let checksum = 0xffffffff;
  for (const byte of data) {
    checksum = (checksum >>> 8) ^ crc32Table[(checksum ^ byte) & 0xff];
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function zipDateTime(date: Date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function assertZip32Value(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new RangeError(`${label} exceeds the ZIP32 limit of ${MAX_UINT32} bytes.`);
  }
}

function asBlobBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return Uint8Array.from(data);
}

type PreparedEntry = {
  name: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
  checksum: number;
  localHeaderOffset: number;
};

/**
 * Creates a dependency-free ZIP32 archive using the universally supported
 * "store" method. Files are not compressed, which keeps this implementation
 * synchronous and compatible with modern browsers without native ZIP APIs.
 */
export function createZipBlob(entries: readonly ZipEntry[]): Blob {
  if (entries.length > MAX_UINT16) {
    throw new RangeError(`ZIP32 supports at most ${MAX_UINT16} entries.`);
  }

  const encoder = new TextEncoder();
  const timestamp = zipDateTime(new Date());
  const names = new Set<string>();
  const localParts: BlobPart[] = [];
  const preparedEntries: PreparedEntry[] = [];
  let localSize = 0;

  for (const entry of entries) {
    if (!entry.name || entry.name.includes("\0")) {
      throw new TypeError("ZIP entry names must be non-empty and cannot contain null bytes.");
    }
    if (names.has(entry.name)) {
      throw new TypeError(`Duplicate ZIP entry name: ${entry.name}`);
    }
    names.add(entry.name);

    const name = encoder.encode(entry.name);
    if (name.byteLength > MAX_UINT16) {
      throw new RangeError(`ZIP entry name exceeds ${MAX_UINT16} UTF-8 bytes: ${entry.name}`);
    }

    const inputData = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    assertZip32Value(inputData.byteLength, `ZIP entry ${entry.name}`);
    const data = asBlobBytes(inputData);
    const checksum = crc32(data);
    const localHeaderOffset = localSize;
    const localHeader = new Uint8Array(LOCAL_FILE_HEADER_SIZE);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, UTF8_FILENAME_FLAG, true);
    view.setUint16(8, STORE_COMPRESSION_METHOD, true);
    view.setUint16(10, timestamp.time, true);
    view.setUint16(12, timestamp.date, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, data.byteLength, true);
    view.setUint32(22, data.byteLength, true);
    view.setUint16(26, name.byteLength, true);
    view.setUint16(28, 0, true);

    const recordSize = LOCAL_FILE_HEADER_SIZE + name.byteLength + data.byteLength;
    assertZip32Value(localSize + recordSize, "ZIP local file data");
    localParts.push(localHeader, name, data);
    preparedEntries.push({ name, data, checksum, localHeaderOffset });
    localSize += recordSize;
  }

  const centralParts: BlobPart[] = [];
  let centralSize = 0;

  for (const entry of preparedEntries) {
    const centralHeader = new Uint8Array(CENTRAL_DIRECTORY_HEADER_SIZE);
    const view = new DataView(centralHeader.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, ZIP_VERSION, true);
    view.setUint16(8, UTF8_FILENAME_FLAG, true);
    view.setUint16(10, STORE_COMPRESSION_METHOD, true);
    view.setUint16(12, timestamp.time, true);
    view.setUint16(14, timestamp.date, true);
    view.setUint32(16, entry.checksum, true);
    view.setUint32(20, entry.data.byteLength, true);
    view.setUint32(24, entry.data.byteLength, true);
    view.setUint16(28, entry.name.byteLength, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.localHeaderOffset, true);

    const recordSize = CENTRAL_DIRECTORY_HEADER_SIZE + entry.name.byteLength;
    assertZip32Value(centralSize + recordSize, "ZIP central directory");
    centralParts.push(centralHeader, entry.name);
    centralSize += recordSize;
  }

  const archiveSize = localSize + centralSize + END_OF_CENTRAL_DIRECTORY_SIZE;
  assertZip32Value(archiveSize, "ZIP archive");

  const endRecord = new Uint8Array(END_OF_CENTRAL_DIRECTORY_SIZE);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, preparedEntries.length, true);
  endView.setUint16(10, preparedEntries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localSize, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}
