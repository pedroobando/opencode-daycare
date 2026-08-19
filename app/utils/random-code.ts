export const ALPHANUMERIC_CHARS: readonly string[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
];

export const generateAlphanumericCode = (length: number): string => {
  if (length <= 0) {
    return '';
  }

  let code = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ALPHANUMERIC_CHARS.length);
    code += ALPHANUMERIC_CHARS[randomIndex];
  }

  return code;
};
