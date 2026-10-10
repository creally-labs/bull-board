import type { QueueMetrics } from '@bull-board/api/typings/app';
import {
  anchorSample,
  backlogOf,
  computeQueueRate,
  formatDuration,
  formatRate,
  hasRecordedMetrics,
  processedPerMinute,
} from '../../src/queueBoard/rates';

const MINUTE = 60_000;
const NOW = 1_000 * MINUTE + 30_000;

function metrics({
  lastMinute,
  partial,
  data,
}: {
  lastMinute: number;
  partial: number;
  data: number[];
}): QueueMetrics {
  return {
    meta: { count: 500 + partial, prevTS: lastMinute * MINUTE + 5_000, prevCount: 500 },
    data,
    count: data.length,
  };
}

describe('processedPerMinute', () => {
  it('averages the finished minutes of the window, newest point being the minute before prevTS', () => {
    const series = metrics({ lastMinute: 999, partial: 6, data: [4, 2, 100] });

    expect(processedPerMinute([series], NOW, 3)).toBe((6 + 4 + 2) / 3);
  });

  it('counts minutes after the last completion as empty', () => {
    const series = metrics({ lastMinute: 990, partial: 30, data: [30] });

    expect(processedPerMinute([series], NOW, 5)).toBe(0);
  });

  it('leaves out the minute that is still running', () => {
    const series = metrics({ lastMinute: 1_000, partial: 50, data: [10] });

    expect(processedPerMinute([series], NOW, 1)).toBe(10);
  });

  it('adds completed and failed series together', () => {
    const completed = metrics({ lastMinute: 999, partial: 6, data: [] });
    const failed = metrics({ lastMinute: 999, partial: 3, data: [] });

    expect(processedPerMinute([completed, failed], NOW, 1)).toBe(9);
  });

  it('is zero for a queue that never recorded metrics', () => {
    const empty: QueueMetrics = { meta: { count: 0, prevTS: 0, prevCount: 0 }, data: [], count: 0 };

    expect(processedPerMinute([empty], NOW, 15)).toBe(0);
  });
});

describe('anchorSample', () => {
  const samples = [
    { at: NOW - 20 * MINUTE, backlog: 1 },
    { at: NOW - 16 * MINUTE, backlog: 2 },
    { at: NOW - 5 * MINUTE, backlog: 3 },
  ];

  it('takes the newest sample that is at least a window old', () => {
    expect(anchorSample(samples, NOW, 15)).toBe(samples[1]);
  });

  it('falls back to the oldest sample when the history is shorter than the window', () => {
    expect(anchorSample(samples.slice(2), NOW, 15)).toBe(samples[2]);
  });

  it('has no anchor without samples', () => {
    expect(anchorSample([], NOW, 15)).toBeNull();
  });
});

describe('computeQueueRate', () => {
  const tenMinutesAgo = (backlog: number) => ({ at: NOW - 10 * MINUTE, backlog });

  it('derives the ETA from how fast the backlog shrinks, not from raw throughput', () => {
    const rate = computeQueueRate({
      backlog: 600,
      throughputPerMinute: 100,
      anchor: tenMinutesAgo(1_000),
      now: NOW,
    });

    expect(rate.trend).toBe('draining');
    expect(rate.inflowPerMinute).toBe(60);
    expect(rate.etaSeconds).toBe((600 / 40) * 60);
  });

  it('reports a growing backlog when inflow outpaces processing', () => {
    const rate = computeQueueRate({
      backlog: 1_200,
      throughputPerMinute: 100,
      anchor: tenMinutesAgo(1_000),
      now: NOW,
    });

    expect(rate.trend).toBe('growing');
    expect(rate.inflowPerMinute).toBe(120);
    expect(rate.etaSeconds).toBeNull();
  });

  it('reports a stalled queue when nothing is processed', () => {
    const rate = computeQueueRate({
      backlog: 50,
      throughputPerMinute: 0,
      anchor: tenMinutesAgo(50),
      now: NOW,
    });

    expect(rate.trend).toBe('stalled');
  });

  it('estimates from throughput alone until it has watched the backlog for a minute', () => {
    const rate = computeQueueRate({
      backlog: 300,
      throughputPerMinute: 30,
      anchor: { at: NOW - 20_000, backlog: 320 },
      now: NOW,
    });

    expect(rate.trend).toBe('warming');
    expect(rate.inflowPerMinute).toBeNull();
    expect(rate.etaSeconds).toBe(600);
  });

  it('is idle with an empty backlog', () => {
    const rate = computeQueueRate({
      backlog: 0,
      throughputPerMinute: 12,
      anchor: tenMinutesAgo(0),
      now: NOW,
    });

    expect(rate).toMatchObject({ trend: 'idle', etaSeconds: 0, inflowPerMinute: 12 });
  });
});

describe('backlogOf', () => {
  it('counts jobs waiting, prioritized, paused and in progress', () => {
    const counts = { waiting: 3, prioritized: 2, active: 4, paused: 1, delayed: 50, failed: 7 };

    expect(backlogOf({ counts } as never)).toBe(10);
  });
});

describe('formatting', () => {
  it.each([
    [30, '<1m'],
    [90, '2m'],
    [3_600, '1h'],
    [5_400, '1h 30m'],
    [3 * 86_400, '3d'],
  ])('formats %ss as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it.each([
    [0, '0/min'],
    [0.5, '30/h'],
    [2.25, '2.3/min'],
    [42.4, '42/min'],
  ])('formats %s per minute as %s', (perMinute, expected) => {
    expect(formatRate(perMinute)).toBe(expected);
  });
});

describe('hasRecordedMetrics', () => {
  it('is false for a queue whose workers never recorded metrics, so no rate is shown', () => {
    const silent: QueueMetrics = {
      meta: { count: 0, prevTS: 0, prevCount: 0 },
      data: [],
      count: 0,
    };

    expect(hasRecordedMetrics([])).toBe(false);
    expect(hasRecordedMetrics([silent, silent])).toBe(false);
    expect(hasRecordedMetrics([silent, metrics({ lastMinute: 999, partial: 1, data: [] })])).toBe(
      true
    );
  });
});
