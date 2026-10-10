import cn from 'clsx';
import { Tooltip } from '../components/Tooltip/Tooltip';
import { useQueueRate } from './QueueRatesProvider';
import type { QueueRate } from './rates';
import { formatDuration, formatRate } from './rates';
import s from './QueueRateBadge.module.css';

function headline(rate: QueueRate): string {
  switch (rate.trend) {
    case 'idle':
      return 'empty';
    case 'draining':
      return `ETA ${formatDuration(rate.etaSeconds ?? 0)}`;
    case 'warming':
      return rate.etaSeconds === null ? 'measuring…' : `ETA ~${formatDuration(rate.etaSeconds)}`;
    case 'growing':
      return 'growing';
    case 'stalled':
      return 'stalled';
  }
}

function details(rate: QueueRate): string {
  const inflow =
    rate.inflowPerMinute === null
      ? 'inflow: measuring (needs a minute of polling)'
      : `inflow: ${formatRate(rate.inflowPerMinute)}`;

  return [
    `backlog: ${rate.backlog}`,
    `processed: ${formatRate(rate.throughputPerMinute)} (last 15 min)`,
    inflow,
  ].join(' · ');
}

export const QueueRateLine = ({ rate, className }: { rate: QueueRate; className?: string }) => (
  <Tooltip title={details(rate)} className={cn(s.line, s[rate.trend], className)}>
    <span className={s.throughput}>{formatRate(rate.throughputPerMinute)}</span>
    <span className={s.separator}>·</span>
    <span className={s.headline}>{headline(rate)}</span>
  </Tooltip>
);

export const QueueRateBadge = ({
  queueName,
  className,
}: {
  queueName: string;
  className?: string;
}) => {
  const rate = useQueueRate(queueName);

  return rate ? <QueueRateLine rate={rate} className={className} /> : null;
};
