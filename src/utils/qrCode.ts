const VERSION = 5;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 108;
const EC_CODEWORDS = 26;

type MatrixCell = boolean | null;

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);

let value = 1;
for (let i = 0; i < 255; i += 1) {
  EXP[i] = value;
  LOG[value] = i;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

const generatorPoly = (degree: number) => {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMul(coefficient, EXP[i]);
    });
    poly = next;
  }
  return poly;
};

const reedSolomon = (data: number[], degree: number) => {
  const generator = generatorPoly(degree);
  const result = [...data, ...new Array(degree).fill(0)];
  data.forEach((_, index) => {
    const coefficient = result[index];
    if (coefficient === 0) return;
    generator.forEach((generatorCoefficient, generatorIndex) => {
      result[index + generatorIndex] ^= gfMul(generatorCoefficient, coefficient);
    });
  });
  return result.slice(data.length);
};

const writeBits = (bits: number[], valueToWrite: number, length: number) => {
  for (let bit = length - 1; bit >= 0; bit -= 1) bits.push((valueToWrite >>> bit) & 1);
};

const encodeData = (payload: string) => {
  const bytes = [...new TextEncoder().encode(payload)];
  if (bytes.length > 106) {
    throw new Error('QR payload is too long for the demo QR encoder.');
  }

  const bits: number[] = [];
  writeBits(bits, 0b0100, 4);
  writeBits(bits, bytes.length, 8);
  bytes.forEach((byte) => writeBits(bits, byte, 8));
  const remaining = DATA_CODEWORDS * 8 - bits.length;
  writeBits(bits, 0, Math.min(4, remaining));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  for (let pad = 0; codewords.length < DATA_CODEWORDS; pad += 1) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11);
  }
  return codewords;
};

const setModule = (matrix: MatrixCell[][], reserved: boolean[][], x: number, y: number, dark: boolean, isReserved = true) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  matrix[y][x] = dark;
  if (isReserved) reserved[y][x] = true;
};

const addFinder = (matrix: MatrixCell[][], reserved: boolean[][], x: number, y: number) => {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const inCore = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inCore && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setModule(matrix, reserved, xx, yy, dark);
    }
  }
};

const addAlignment = (matrix: MatrixCell[][], reserved: boolean[][], centerX: number, centerY: number) => {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(matrix, reserved, centerX + dx, centerY + dy, distance !== 1);
    }
  }
};

const reserveFormatAreas = (reserved: boolean[][]) => {
  for (let index = 0; index < 9; index += 1) {
    reserved[8][index] = true;
    reserved[index][8] = true;
    reserved[8][SIZE - 1 - index] = true;
    reserved[SIZE - 1 - index][8] = true;
  }
};

const addPatterns = (matrix: MatrixCell[][], reserved: boolean[][]) => {
  addFinder(matrix, reserved, 0, 0);
  addFinder(matrix, reserved, SIZE - 7, 0);
  addFinder(matrix, reserved, 0, SIZE - 7);
  addAlignment(matrix, reserved, 30, 30);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setModule(matrix, reserved, index, 6, index % 2 === 0);
    setModule(matrix, reserved, 6, index, index % 2 === 0);
  }
  setModule(matrix, reserved, 8, VERSION * 4 + 9, true);
  reserveFormatAreas(reserved);
};

const mask = (x: number, y: number) => (x + y) % 2 === 0;

const addData = (matrix: MatrixCell[][], reserved: boolean[][], bytes: number[]) => {
  const bits = bytes.flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1));
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (reserved[y][x]) continue;
        const raw = (bits[bitIndex] ?? 0) === 1;
        matrix[y][x] = raw !== mask(x, y);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
};

const formatBits = () => {
  const ecLevelL = 0b01;
  const maskPattern = 0b000;
  let data = (ecLevelL << 3) | maskPattern;
  let bits = data << 10;
  const generator = 0b10100110111;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((bits >>> bit) & 1) bits ^= generator << (bit - 10);
  }
  return (((data << 10) | bits) ^ 0b101010000010010) & 0x7fff;
};

const addFormat = (matrix: MatrixCell[][]) => {
  const bits = formatBits();
  const first = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const second = [
    [SIZE - 1, 8], [SIZE - 2, 8], [SIZE - 3, 8], [SIZE - 4, 8], [SIZE - 5, 8], [SIZE - 6, 8], [SIZE - 7, 8],
    [8, SIZE - 8], [8, SIZE - 7], [8, SIZE - 6], [8, SIZE - 5], [8, SIZE - 4], [8, SIZE - 3], [8, SIZE - 2], [8, SIZE - 1],
  ];
  first.forEach(([x, y], index) => {
    matrix[y][x] = Boolean((bits >>> index) & 1);
  });
  second.forEach(([x, y], index) => {
    matrix[y][x] = Boolean((bits >>> index) & 1);
  });
};

export const createQrMatrix = (payload: string) => {
  const matrix: MatrixCell[][] = Array.from({ length: SIZE }, () => new Array<MatrixCell>(SIZE).fill(null));
  const reserved = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
  addPatterns(matrix, reserved);
  const data = encodeData(payload);
  addData(matrix, reserved, [...data, ...reedSolomon(data, EC_CODEWORDS)]);
  addFormat(matrix);
  return matrix.map((row) => row.map(Boolean));
};
