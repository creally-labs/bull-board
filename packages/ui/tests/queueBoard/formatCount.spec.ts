import { formatCount, groupDigitsPostProcessor } from '../../src/queueBoard/formatCount';

const GAP = ' ';

it.each([
  [0, '0'],
  [9_999, '9999'],
  [41_710, `41${GAP}710`],
  [1_234_567, `1${GAP}234${GAP}567`],
  [-50_000, `-50${GAP}000`],
  [1.5, '1.5'],
])('formats %s as %s', (value, expected) => {
  expect(formatCount(value)).toBe(expected);
});

it('groups every number inside a translated label', () => {
  const process = groupDigitsPostProcessor.process as (value: string) => string;

  expect(process('41710 Jobs')).toBe(`41${GAP}710 Jobs`);
  expect(process('1 Job')).toBe('1 Job');
});
