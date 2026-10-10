import type { AppQueue } from '@bull-board/api/typings/app';
import cn from 'clsx';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatCount } from '../../../queueBoard/formatCount';
import { dynamicTranslationKey } from '../../../utils/dynamicTranslationKey';
import { links } from '../../../utils/links';
import { toCamelCase } from '../../../utils/toCamelCase';
import { HoverPanel } from '../../HoverPanel/HoverPanel';
import s from './QueueStats.module.css';

interface IQueueStatsProps {
  queue: AppQueue;
}

export const QueueStats = ({ queue }: IQueueStatsProps) => {
  const { t } = useTranslation();
  const total = queue.statuses.reduce((result, status) => result + (queue.counts[status] || 0), 0);
  const nonZeroStatuses = queue.statuses.filter((status) => (queue.counts[status] ?? 0) > 0);
  const queued =
    (queue.counts.waiting || 0) + (queue.counts.prioritized || 0) + (queue.counts.paused || 0);
  const active = queue.counts.active || 0;
  const failed = queue.counts.failed || 0;
  const jobsLabel = t('DASHBOARD.JOBS_COUNT', { count: total, postProcess: 'groupDigits' });

  /* The queue pulse: proportional per-status composition of the queue. */
  const pulse = (
    <span className={s.pulse}>
      {total === 0 ? (
        <span className={s.emptyBar} />
      ) : (
        nonZeroStatuses.map((status) => (
          <span
            key={status}
            style={{ width: `${((queue.counts[status] ?? 0) / total) * 100}%` }}
            className={cn(s[toCamelCase(status)], s.bar)}
          />
        ))
      )}
    </span>
  );

  return (
    <div className={s.stats}>
      {total === 0 ? (
        <div className={s.pulseStatic}>{pulse}</div>
      ) : (
        <HoverPanel
          triggerLabel={jobsLabel}
          rows={nonZeroStatuses.map((status) => ({
            id: status,
            color: `var(--status-${status})`,
            label: t(dynamicTranslationKey(`QUEUE.STATUS.${status.toUpperCase()}`)),
            value: formatCount(queue.counts[status] ?? 0),
            to: links.queuePage(queue.name, { [queue.name]: status }),
          }))}
        >
          {pulse}
        </HoverPanel>
      )}
      <div className={s.footer}>
        {queued > 0 && (
          <Link
            to={links.queuePage(queue.name, { [queue.name]: 'waiting' })}
            className={cn(s.flag, s.flagPrimary)}
            style={{ '--flag-color': 'var(--status-waiting)' } as CSSProperties}
          >
            <span className={s.flagDot} />
            Queued
            <span className={s.flagCount}>{formatCount(queued)}</span>
          </Link>
        )}
        {active > 0 && (
          <Link
            to={links.queuePage(queue.name, { [queue.name]: 'active' })}
            className={s.flag}
            style={{ '--flag-color': 'var(--status-active)' } as CSSProperties}
          >
            <span className={s.flagDot} />
            {t('QUEUE.STATUS.ACTIVE')}
            <span className={s.flagCount}>{formatCount(active)}</span>
          </Link>
        )}
        {failed > 0 && (
          <Link
            to={links.queuePage(queue.name, { [queue.name]: 'failed' })}
            className={s.flag}
            style={{ '--flag-color': 'var(--status-failed)' } as CSSProperties}
          >
            <span className={s.flagDot} />
            {t('QUEUE.STATUS.FAILED')}
            <span className={s.flagCount}>{formatCount(failed)}</span>
          </Link>
        )}
        <span className={s.total}>{jobsLabel}</span>
      </div>
    </div>
  );
};
