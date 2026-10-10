import type { QueueMetrics } from '@bull-board/api/typings/app';
import { useQueries } from '@tanstack/react-query';
import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { queryKeys } from '../hooks/queryKeys';
import { useApi } from '../hooks/useApi';
import { useQueues } from '../hooks/useQueues';
import { getQueueBoardConfig } from './config';
import type { BacklogSample, QueueRate } from './rates';
import {
  RATE_WINDOW_MINUTES,
  anchorSample,
  backlogOf,
  hasRecordedMetrics,
  computeQueueRate,
  processedPerMinute,
} from './rates';

const METRICS_REFRESH_MS = 60_000;
const SAMPLE_RETENTION_MS = RATE_WINDOW_MINUTES * 60_000;

const QueueRatesContext = React.createContext<Map<string, QueueRate>>(new Map());

export function useQueueRate(queueName: string): QueueRate | null {
  return useContext(QueueRatesContext).get(queueName) ?? null;
}

export function useQueueRates(): Map<string, QueueRate> {
  return useContext(QueueRatesContext);
}

function useBacklogSamples(backlogs: Map<string, number> | null): Map<string, BacklogSample[]> {
  const samples = useRef(new Map<string, BacklogSample[]>());

  useEffect(() => {
    if (!backlogs) {
      return;
    }

    const now = Date.now();
    backlogs.forEach((backlog, name) => {
      const history = samples.current.get(name) ?? [];
      const firstInWindow = history.findIndex((sample) => sample.at > now - SAMPLE_RETENTION_MS);
      const kept =
        firstInWindow === -1 ? history.slice(-1) : history.slice(Math.max(0, firstInWindow - 1));
      samples.current.set(name, [...kept, { at: now, backlog }]);
    });
  }, [backlogs]);

  return samples.current;
}

const MeasuredQueueRates = ({ children }: { children: React.ReactNode }) => {
  const api = useApi();
  const { queues, isTransitioning } = useQueues();
  const names = useMemo(() => (queues ?? []).map((queue) => queue.name), [queues]);

  const backlogs = useMemo(
    () =>
      queues && !isTransitioning
        ? new Map(queues.map((queue) => [queue.name, backlogOf(queue)]))
        : null,
    [queues, isTransitioning]
  );
  const samples = useBacklogSamples(backlogs);

  const metrics = useQueries({
    queries: names.map((name) => ({
      queryKey: queryKeys.metrics(name),
      queryFn: () => api.getMetrics(name),
      refetchInterval: METRICS_REFRESH_MS,
      staleTime: METRICS_REFRESH_MS,
    })),
  });

  const rates = new Map<string, QueueRate>();
  const now = Date.now();

  (queues ?? []).forEach((queue, index) => {
    const response = metrics[index]?.data;
    const series = [response?.completed, response?.failed].filter(
      (entry): entry is QueueMetrics => !!entry
    );

    if (!hasRecordedMetrics(series)) {
      return;
    }

    rates.set(
      queue.name,
      computeQueueRate({
        backlog: backlogOf(queue),
        throughputPerMinute: processedPerMinute(series, now),
        anchor: anchorSample(samples.get(queue.name) ?? [], now),
        now,
      })
    );
  });

  return <QueueRatesContext.Provider value={rates}>{children}</QueueRatesContext.Provider>;
};

export const QueueRatesProvider = ({ children }: { children: React.ReactNode }) =>
  getQueueBoardConfig() ? <MeasuredQueueRates>{children}</MeasuredQueueRates> : <>{children}</>;
