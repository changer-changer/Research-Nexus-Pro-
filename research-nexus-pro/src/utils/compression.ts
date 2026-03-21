/**
 * Compression Utilities - 数据压缩工具
 * 支持MessagePack、JSON压缩等
 */

/**
 * 简单的MessagePack-like编码
 * 用于高效的数据序列化
 */

// 类型标记
const TYPE_MARKERS = {
  NULL: 0xc0,
  FALSE: 0xc2,
  TRUE: 0xc3,
  INT8: 0xd0,
  INT16: 0xd1,
  INT32: 0xd2,
  UINT8: 0xcc,
  UINT16: 0xcd,
  UINT32: 0xce,
  FLOAT32: 0xca,
  FLOAT64: 0xcb,
  STR8: 0xd9,
  STR16: 0xda,
  STR32: 0xdb,
  BIN8: 0xc4,
  BIN16: 0xc5,
  BIN32: 0xc6,
  ARRAY16: 0xdc,
  ARRAY32: 0xdd,
  MAP16: 0xde,
  MAP32: 0xdf,
} as const;

/**
 * 编码器类
 */
class Encoder {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number;

  constructor(initialSize: number = 1024) {
    this.buffer = new Uint8Array(initialSize);
    this.view = new DataView(this.buffer.buffer);
    this.offset = 0;
  }

  private ensureSpace(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, this.offset + bytes);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  private writeUint8(value: number): void {
    this.ensureSpace(1);
    this.view.setUint8(this.offset++, value);
  }

  private writeInt8(value: number): void {
    this.ensureSpace(1);
    this.view.setInt8(this.offset++, value);
  }

  private writeInt16(value: number): void {
    this.ensureSpace(2);
    this.view.setInt16(this.offset, value);
    this.offset += 2;
  }

  private writeInt32(value: number): void {
    this.ensureSpace(4);
    this.view.setInt32(this.offset, value);
    this.offset += 4;
  }

  private writeUint32(value: number): void {
    this.ensureSpace(4);
    this.view.setUint32(this.offset, value);
    this.offset += 4;
  }

  private writeFloat64(value: number): void {
    this.ensureSpace(8);
    this.view.setFloat64(this.offset, value);
    this.offset += 8;
  }

  private writeBytes(bytes: Uint8Array): void {
    this.ensureSpace(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  encode(value: any): Uint8Array {
    this.offset = 0;
    this.encodeValue(value);
    return this.buffer.slice(0, this.offset);
  }

  private encodeValue(value: any): void {
    if (value === null) {
      this.writeUint8(TYPE_MARKERS.NULL);
    } else if (value === false) {
      this.writeUint8(TYPE_MARKERS.FALSE);
    } else if (value === true) {
      this.writeUint8(TYPE_MARKERS.TRUE);
    } else if (typeof value === 'number') {
      this.encodeNumber(value);
    } else if (typeof value === 'string') {
      this.encodeString(value);
    } else if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      this.encodeBinary(value);
    } else if (Array.isArray(value)) {
      this.encodeArray(value);
    } else if (typeof value === 'object') {
      this.encodeObject(value);
    }
  }

  private encodeNumber(value: number): void {
    if (Number.isInteger(value)) {
      if (value >= 0 && value <= 0x7f) {
        // 正fixint
        this.writeUint8(value);
      } else if (value < 0 && value >= -32) {
        // 负fixint
        this.writeInt8(value);
      } else if (value >= -128 && value <= 127) {
        this.writeUint8(TYPE_MARKERS.INT8);
        this.writeInt8(value);
      } else if (value >= -32768 && value <= 32767) {
        this.writeUint8(TYPE_MARKERS.INT16);
        this.writeInt16(value);
      } else {
        this.writeUint8(TYPE_MARKERS.INT32);
        this.writeInt32(value);
      }
    } else {
      this.writeUint8(TYPE_MARKERS.FLOAT64);
      this.writeFloat64(value);
    }
  }

  private encodeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);

    if (bytes.length <= 31) {
      // fixstr
      this.writeUint8(0xa0 | bytes.length);
    } else if (bytes.length <= 255) {
      this.writeUint8(TYPE_MARKERS.STR8);
      this.writeUint8(bytes.length);
    } else if (bytes.length <= 65535) {
      this.writeUint8(TYPE_MARKERS.STR16);
      this.writeInt16(bytes.length);
    } else {
      this.writeUint8(TYPE_MARKERS.STR32);
      this.writeInt32(bytes.length);
    }

    this.writeBytes(bytes);
  }

  private encodeBinary(value: Uint8Array | ArrayBuffer): void {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;

    if (bytes.length <= 255) {
      this.writeUint8(TYPE_MARKERS.BIN8);
      this.writeUint8(bytes.length);
    } else if (bytes.length <= 65535) {
      this.writeUint8(TYPE_MARKERS.BIN16);
      this.writeInt16(bytes.length);
    } else {
      this.writeUint8(TYPE_MARKERS.BIN32);
      this.writeInt32(bytes.length);
    }

    this.writeBytes(bytes);
  }

  private encodeArray(value: any[]): void {
    if (value.length <= 15) {
      // fixarray
      this.writeUint8(0x90 | value.length);
    } else if (value.length <= 65535) {
      this.writeUint8(TYPE_MARKERS.ARRAY16);
      this.writeInt16(value.length);
    } else {
      this.writeUint8(TYPE_MARKERS.ARRAY32);
      this.writeInt32(value.length);
    }

    for (const item of value) {
      this.encodeValue(item);
    }
  }

  private encodeObject(value: Record<string, any>): void {
    const keys = Object.keys(value);

    if (keys.length <= 15) {
      // fixmap
      this.writeUint8(0x80 | keys.length);
    } else if (keys.length <= 65535) {
      this.writeUint8(TYPE_MARKERS.MAP16);
      this.writeInt16(keys.length);
    } else {
      this.writeUint8(TYPE_MARKERS.MAP32);
      this.writeInt32(keys.length);
    }

    for (const key of keys) {
      this.encodeString(key);
      this.encodeValue(value[key]);
    }
  }
}

/**
 * 解码器类
 */
class Decoder {
  private view: DataView;
  private offset: number;

  constructor(buffer: Uint8Array | ArrayBuffer) {
    this.view = new DataView(
      buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
    );
    this.offset = 0;
  }

  private readUint8(): number {
    return this.view.getUint8(this.offset++);
  }

  private readInt8(): number {
    return this.view.getInt8(this.offset++);
  }

  private readInt16(): number {
    const value = this.view.getInt16(this.offset);
    this.offset += 2;
    return value;
  }

  private readInt32(): number {
    const value = this.view.getInt32(this.offset);
    this.offset += 4;
    return value;
  }

  private readUint32(): number {
    const value = this.view.getUint32(this.offset);
    this.offset += 4;
    return value;
  }

  private readFloat64(): number {
    const value = this.view.getFloat64(this.offset);
    this.offset += 8;
    return value;
  }

  private readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }

  decode(): any {
    return this.decodeValue();
  }

  private decodeValue(): any {
    const byte = this.readUint8();

    // 正fixint: 0x00 - 0x7f
    if (byte <= 0x7f) {
      return byte;
    }

    // 负fixint: 0xe0 - 0xff
    if (byte >= 0xe0) {
      return byte - 256;
    }

    // fixstr: 0xa0 - 0xbf
    if ((byte & 0xe0) === 0xa0) {
      const length = byte & 0x1f;
      return this.decodeString(length);
    }

    // fixarray: 0x90 - 0x9f
    if ((byte & 0xf0) === 0x90) {
      const length = byte & 0x0f;
      return this.decodeArray(length);
    }

    // fixmap: 0x80 - 0x8f
    if ((byte & 0xf0) === 0x80) {
      const length = byte & 0x0f;
      return this.decodeMap(length);
    }

    // 其他类型
    switch (byte) {
      case TYPE_MARKERS.NULL:
        return null;
      case TYPE_MARKERS.FALSE:
        return false;
      case TYPE_MARKERS.TRUE:
        return true;
      case TYPE_MARKERS.INT8:
        return this.readInt8();
      case TYPE_MARKERS.INT16:
        return this.readInt16();
      case TYPE_MARKERS.INT32:
        return this.readInt32();
      case TYPE_MARKERS.UINT8:
        return this.readUint8();
      case TYPE_MARKERS.UINT16:
        return this.readInt16() & 0xffff;
      case TYPE_MARKERS.UINT32:
        return this.readUint32();
      case TYPE_MARKERS.FLOAT64:
        return this.readFloat64();
      case TYPE_MARKERS.STR8:
        return this.decodeString(this.readUint8());
      case TYPE_MARKERS.STR16:
        return this.decodeString(this.readInt16());
      case TYPE_MARKERS.STR32:
        return this.decodeString(this.readInt32());
      case TYPE_MARKERS.BIN8:
        return this.readBytes(this.readUint8());
      case TYPE_MARKERS.BIN16:
        return this.readBytes(this.readInt16());
      case TYPE_MARKERS.BIN32:
        return this.readBytes(this.readInt32());
      case TYPE_MARKERS.ARRAY16:
        return this.decodeArray(this.readInt16());
      case TYPE_MARKERS.ARRAY32:
        return this.decodeArray(this.readInt32());
      case TYPE_MARKERS.MAP16:
        return this.decodeMap(this.readInt16());
      case TYPE_MARKERS.MAP32:
        return this.decodeMap(this.readInt32());
      default:
        throw new Error(`Unknown type marker: 0x${byte.toString(16)}`);
    }
  }

  private decodeString(length: number): string {
    const bytes = this.readBytes(length);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  private decodeArray(length: number): any[] {
    const result = [];
    for (let i = 0; i < length; i++) {
      result.push(this.decodeValue());
    }
    return result;
  }

  private decodeMap(length: number): Record<string, any> {
    const result: Record<string, any> = {};
    for (let i = 0; i < length; i++) {
      const key = this.decodeValue();
      const value = this.decodeValue();
      result[key] = value;
    }
    return result;
  }
}

/**
 * 编码数据为MessagePack格式
 */
export function encode(data: any): Uint8Array {
  const encoder = new Encoder();
  return encoder.encode(data);
}

/**
 * 解码MessagePack数据
 */
export function decode(buffer: Uint8Array | ArrayBuffer): any {
  const decoder = new Decoder(buffer);
  return decoder.decode();
}

/**
 * 压缩JSON字符串
 */
export function compressJSON(json: string): string {
  // 移除不必要的空白
  return json
    .replace(/\n\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}\[\]:,])\s*/g, '$1');
}

/**
 * 压缩对象并转为base64
 */
export function pack(data: any): string {
  const encoded = encode(data);
  return uint8ArrayToBase64(encoded);
}

/**
 * 从base64解包数据
 */
export function unpack(base64: string): any {
  const bytes = base64ToUint8Array(base64);
  return decode(bytes);
}

/**
 * Uint8Array转Base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  }
  return btoa(chunks.join(''));
}

/**
 * Base64转Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * LZ77-like 简单压缩（用于重复数据）
 */
export function simpleCompress(data: string): string {
  const dict: Map<string, number> = new Map();
  const result: (string | number)[] = [];
  let i = 0;

  while (i < data.length) {
    let longestMatch = '';
    let longestIndex = -1;

    // 查找最长匹配
    for (let j = Math.max(0, i - 1024); j < i; j++) {
      let match = '';
      let k = 0;
      while (i + k < data.length && data[j + k] === data[i + k] && k < 32) {
        match += data[i + k];
        k++;
      }
      if (match.length > longestMatch.length) {
        longestMatch = match;
        longestIndex = i - j;
      }
    }

    if (longestMatch.length > 3) {
      result.push(longestIndex, longestMatch.length);
      i += longestMatch.length;
    } else {
      result.push(data[i]);
      i++;
    }
  }

  return JSON.stringify(result);
}

/**
 * Worker间传输数据优化
 */
export function optimizeForTransfer(data: any): {
  data: any;
  transferables: Transferable[];
} {
  const transferables: Transferable[] = [];

  function process(obj: any): any {
    if (obj instanceof ArrayBuffer) {
      transferables.push(obj);
      return obj;
    }
    if (obj instanceof Uint8Array || obj instanceof Float64Array) {
      transferables.push(obj.buffer);
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(process);
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = process(value);
      }
      return result;
    }
    return obj;
  }

  return { data: process(data), transferables };
}
