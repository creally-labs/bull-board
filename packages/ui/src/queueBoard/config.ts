import type { UIConfig } from '@bull-board/api/typings/app';

export interface QueueBoardQueue {
  /** Slash-separated path of the group the queue is listed under, e.g. `Search/Profile`. */
  group: string;
  /** Queues this queue enqueues jobs into. */
  feeds: string[];
}

export interface QueueBoardConfig {
  queues: Record<string, QueueBoardQueue>;
}

export interface QueueBoardUIConfig extends UIConfig {
  queueBoard?: QueueBoardConfig;
}

let queueBoardConfig: QueueBoardConfig | null = null;

export function setQueueBoardConfig(config: QueueBoardConfig | undefined): void {
  queueBoardConfig = config ?? null;
}

export function getQueueBoardConfig(): QueueBoardConfig | null {
  return queueBoardConfig;
}

export function isQueueMapLocation(location: { pathname: string; search: string }): boolean {
  return location.pathname === '/' && new URLSearchParams(location.search).get('view') === 'map';
}

export function queueGroupPath(queueName: string): string[] | null {
  const group = queueBoardConfig?.queues[queueName]?.group;

  return group ? group.split('/').filter(Boolean) : null;
}
