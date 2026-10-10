import type { PostProcessorModule } from 'i18next';

const NARROW_NO_BREAK_SPACE = ' ';
const GROUPING_THRESHOLD = 10_000;

/** Groups thousands with a narrow no-break space from five digits up, so 41710 reads 41 710. */
export function formatCount(value: number): string {
  if (!Number.isInteger(value) || Math.abs(value) < GROUPING_THRESHOLD) {
    return String(value);
  }

  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NO_BREAK_SPACE);
}

export const groupDigitsPostProcessor: PostProcessorModule = {
  type: 'postProcessor',
  name: 'groupDigits',
  process: (value: string) => value.replace(/\d+/g, (digits) => formatCount(Number(digits))),
};
