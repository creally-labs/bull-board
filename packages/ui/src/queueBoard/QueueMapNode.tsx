import type { AppQueue } from '@bull-board/api/typings/app';
import { Handle, Position } from '@xyflow/react';
import cn from 'clsx';
import { QueueStats } from '../components/QueueCard/QueueStats/QueueStats';
import { QueueRateLine } from './QueueRateBadge';
import type { QueueRate } from './rates';
import s from './QueueMapPage.module.css';

export interface QueueMapNodeData {
  name: string;
  group: string;
  color: string;
  rate: QueueRate | null;
  queue: AppQueue | null;
  isPaused: boolean;
  dimmed: boolean;
  /** Links to queues of other groups, drawn only while either end is hovered. */
  external: string[];
}

export const QueueMapBandNode = ({ data }: { data: { name: string; color: string } }) => (
  <div className={s.band} style={{ '--group-color': data.color } as React.CSSProperties}>
    <span className={s.bandLabel}>{data.name}</span>
  </div>
);

export const QueueMapNode = ({ data }: { data: QueueMapNodeData }) => (
  <div
    className={cn(s.node, data.isPaused && s.paused, data.dimmed && s.dimmed)}
    style={{ '--group-color': data.color } as React.CSSProperties}
  >
    <Handle type="target" position={Position.Left} className={s.handle} />
    <span className={s.rail} />
    <div className={s.nodeHeader}>
      <span className={s.nodeName} title={data.name}>
        {data.name}
      </span>
      {data.isPaused && <span className={s.pausedLabel}>paused</span>}
      {data.external.length > 0 && (
        <span className={s.external} title={data.external.join('\n')}>
          ↗ {data.external.length}
        </span>
      )}
    </div>
    <span className={s.nodeGroup}>{data.group}</span>
    <div className={s.nodeStats}>
      {data.rate ? <QueueRateLine rate={data.rate} /> : <span className={s.muted}>no data</span>}
    </div>
    {data.queue && (
      <div className={cn(s.nodeBreakdown, 'nodrag')} onClick={(event) => event.stopPropagation()}>
        <QueueStats queue={data.queue} />
      </div>
    )}
    <Handle type="source" position={Position.Right} className={s.handle} />
  </div>
);
