import type { AppQueue, QueueMetrics } from '@bull-board/api/typings/app';

const MINUTE_MS = 60_000;

export const RATE_WINDOW_MINUTES = 15;
export const MIN_SAMPLE_SPAN_MS = MINUTE_MS;

export type QueueTrend = 'idle' | 'warming' | 'draining' | 'growing' | 'stalled';

export interface BacklogSample {
  at: number;
  backlog: number;
}

export interface QueueRate {
  backlog: number;
  throughputPerMinute: number;
  /** Null until the board has watched the backlog for at least a minute. */
  inflowPerMinute: number | null;
  etaSeconds: number | null;
  trend: QueueTrend;
}

export function backlogOf(queue: Pick<AppQueue, 'counts'>): number {
  const { waiting = 0, prioritized = 0, active = 0, paused = 0 } = queue.counts;

  return waiting + prioritized + active + paused;
}

/**
 * BullMQ keeps one point per finished minute, newest first, starting with the minute before the
 * last recorded completion; that minute itself is still accumulating in `count - prevCount`.
 */
function processedInMinute(metrics: QueueMetrics, minute: number): number {
  const { count, prevTS, prevCount } = metrics.meta;

  if (!prevTS) {
    return 0;
  }

  const lastMinute = Math.floor(prevTS / MINUTE_MS);

  if (minute === lastMinute) {
    return count - prevCount;
  }

  if (minute > lastMinute) {
    return 0;
  }

  return metrics.data[lastMinute - 1 - minute] ?? 0;
}

export function hasRecordedMetrics(metrics: QueueMetrics[]): boolean {
  return metrics.some((series) => series.meta.prevTS > 0);
}

export function processedPerMinute(
  metrics: QueueMetrics[],
  now: number,
  windowMinutes = RATE_WINDOW_MINUTES
): number {
  const currentMinute = Math.floor(now / MINUTE_MS);
  let processed = 0;

  for (let minute = currentMinute - windowMinutes; minute < currentMinute; minute += 1) {
    processed += metrics.reduce((sum, series) => sum + processedInMinute(series, minute), 0);
  }

  return processed / windowMinutes;
}

export function anchorSample(
  samples: BacklogSample[],
  now: number,
  windowMinutes = RATE_WINDOW_MINUTES
): BacklogSample | null {
  const windowStart = now - windowMinutes * MINUTE_MS;
  const beforeWindow = samples.filter((sample) => sample.at <= windowStart);

  return beforeWindow.at(-1) ?? samples[0] ?? null;
}

export function computeQueueRate({
  backlog,
  throughputPerMinute,
  anchor,
  now,
}: {
  backlog: number;
  throughputPerMinute: number;
  anchor: BacklogSample | null;
  now: number;
}): QueueRate {
  const span = anchor ? now - anchor.at : 0;

  if (backlog === 0) {
    const inflowPerMinute = span >= MIN_SAMPLE_SPAN_MS ? throughputPerMinute : null;
    return { backlog, throughputPerMinute, inflowPerMinute, etaSeconds: 0, trend: 'idle' };
  }

  if (!anchor || span < MIN_SAMPLE_SPAN_MS) {
    const etaSeconds = throughputPerMinute > 0 ? (backlog / throughputPerMinute) * 60 : null;
    return { backlog, throughputPerMinute, inflowPerMinute: null, etaSeconds, trend: 'warming' };
  }

  const drainPerMinute = (anchor.backlog - backlog) / (span / MINUTE_MS);
  const inflowPerMinute = Math.max(0, throughputPerMinute - drainPerMinute);

  if (drainPerMinute > 0) {
    const etaSeconds = (backlog / drainPerMinute) * 60;
    return { backlog, throughputPerMinute, inflowPerMinute, etaSeconds, trend: 'draining' };
  }

  const trend = throughputPerMinute > 0 ? 'growing' : 'stalled';
  return { backlog, throughputPerMinute, inflowPerMinute, etaSeconds: null, trend };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return '<1m';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  return `${Math.round(hours / 24)}d`;
}

export function formatRate(perMinute: number): string {
  if (perMinute === 0) {
    return '0/min';
  }

  if (perMinute < 1) {
    return `${Math.round(perMinute * 60)}/h`;
  }

  return perMinute < 10 ? `${perMinute.toFixed(1)}/min` : `${Math.round(perMinute)}/min`;
}
