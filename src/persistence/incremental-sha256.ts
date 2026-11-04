/** Incremental FIPS 180-4 SHA-256. Owns one 64-byte block; never retains caller views. */
export class IncrementalSha256 {
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly block = new Uint8Array(64);
  private readonly schedule = new Uint32Array(64);
  private used = 0;
  private byteLength = 0;
  private result: string | null = null;

  update(bytes: Uint8Array): this {
    if (this.result !== null)
      throw Object.assign(new Error("SHA-256 was already finalized"), { code: "SHA256_FINALIZED" });
    if (!(bytes instanceof Uint8Array)) throw new TypeError("SHA-256 expects Uint8Array bytes");
    if (!Number.isSafeInteger(this.byteLength + bytes.byteLength))
      throw new RangeError("SHA-256 input length exceeds the exact integer range");
    this.byteLength += bytes.byteLength;
    let offset = 0;
    if (this.used > 0) {
      const count = Math.min(64 - this.used, bytes.byteLength);
      this.block.set(bytes.subarray(0, count), this.used);
      this.used += count;
      offset += count;
      if (this.used === 64) {
        this.compress(this.block);
        this.used = 0;
      }
    }
    while (offset + 64 <= bytes.byteLength) {
      this.compress(bytes.subarray(offset, offset + 64));
      offset += 64;
    }
    if (offset < bytes.byteLength) {
      this.block.set(bytes.subarray(offset), 0);
      this.used = bytes.byteLength - offset;
    }
    return this;
  }

  digestHex(): string {
    if (this.result !== null) return this.result;
    this.block[this.used++] = 0x80;
    if (this.used > 56) {
      this.block.fill(0, this.used);
      this.compress(this.block);
      this.used = 0;
    }
    this.block.fill(0, this.used, 56);
    // Split before multiplying, retaining the exact 64-bit bit count for safe byte lengths.
    const high = Math.floor(this.byteLength / 0x20000000);
    const low = (this.byteLength % 0x20000000) * 8;
    const view = new DataView(this.block.buffer);
    view.setUint32(56, high, false);
    view.setUint32(60, low, false);
    this.compress(this.block);
    this.result = [...this.state].map((value) => value.toString(16).padStart(8, "0")).join("");
    return this.result;
  }

  private compress(bytes: Uint8Array): void {
    const words = this.schedule;
    const view = new DataView(bytes.buffer, bytes.byteOffset, 64);
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(index * 4, false);
    const rotate = (value: number, count: number) => (value >>> count) | (value << (32 - count));
    for (let index = 16; index < 64; index++) {
      const a = words[index - 15]!;
      const b = words[index - 2]!;
      const small0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
      const small1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16]! + small0 + words[index - 7]! + small1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.state as unknown as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let index = 0; index < 64; index++) {
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + sum1 + choice + ROUND[index]! + words[index]!) >>> 0;
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    for (const [index, value] of [a, b, c, d, e, f, g, h].entries())
      this.state[index] = (this.state[index]! + value) >>> 0;
  }
}

const ROUND = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
