import { Background, Controls, MarkerType, ReactFlow } from '@xyflow/react';
import cn from 'clsx';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useQueues } from '../hooks/useQueues';
import { links } from '../utils/links';
import { getQueueBoardConfig } from './config';
import { MAP_NODE_HEIGHT, MAP_NODE_WIDTH, layoutQueueMap } from './queueMapLayout';
import type { QueueMapNodeData } from './QueueMapNode';
import { QueueMapBandNode, QueueMapNode } from './QueueMapNode';
import { useQueueRates } from './QueueRatesProvider';
import s from './QueueMapPage.module.css';
import '@xyflow/react/dist/style.css';

const INITIAL_VIEWPORT = { x: 16, y: 16, zoom: 0.8 };

const nodeTypes = { queueNode: QueueMapNode, band: QueueMapBandNode };

const GROUP_COLORS = [
  'var(--status-active)',
  'var(--status-completed)',
  'var(--status-prioritized)',
  'var(--status-waiting)',
  'var(--status-delayed)',
  'var(--status-waiting-children)',
  'var(--status-failed)',
  'var(--status-paused)',
];

const topGroup = (group: string) => group.split('/')[0];

export const QueueMapPage = () => {
  const history = useHistory();
  const [focused, setFocused] = useState<string | null>(null);
  const { queues } = useQueues();
  const rates = useQueueRates();
  const config = getQueueBoardConfig();

  if (!config) {
    return <p className={s.empty}>The queue map needs `uiConfig.queueBoard` on the board.</p>;
  }

  const order = Object.keys(config.queues);
  const feeds = Object.fromEntries(order.map((name) => [name, config.queues[name].feeds]));
  const { positions, edges, bands } = layoutQueueMap(order, feeds, (name) =>
    topGroup(config.queues[name].group)
  );
  const groups = bands.map((band) => band.name);
  const colorOf = (group: string) => GROUP_COLORS[groups.indexOf(group) % GROUP_COLORS.length];
  const queueByName = new Map((queues ?? []).map((queue) => [queue.name, queue]));

  const touchesFocused = (edge: { source: string; target: string }) =>
    edge.source === focused || edge.target === focused;
  const linkedToFocused = new Set(
    edges.filter(touchesFocused).flatMap(({ source, target }) => [source, target])
  );

  const nodes = order.map((name) => {
    const { group } = config.queues[name];
    const queue = queueByName.get(name);
    const data: QueueMapNodeData = {
      name,
      group,
      color: colorOf(topGroup(group)),
      rate: rates.get(name) ?? null,
      queue: queue ?? null,
      isPaused: !!queue?.isPaused,
      dimmed: focused !== null && name !== focused && !linkedToFocused.has(name),
      external: edges
        .filter((edge) => edge.crossBand && (edge.source === name || edge.target === name))
        .map((edge) => (edge.source === name ? `→ ${edge.target}` : `← ${edge.source}`)),
    };

    return {
      id: name,
      type: 'queueNode',
      position: positions.get(name) ?? { x: 0, y: 0 },
      width: MAP_NODE_WIDTH,
      height: MAP_NODE_HEIGHT,
      data: data as unknown as Record<string, unknown>,
    };
  });

  const bandNodes = bands.map((band) => ({
    id: `band:${band.name}`,
    type: 'band',
    position: { x: band.x, y: band.y },
    width: band.width,
    height: band.height,
    zIndex: -1,
    selectable: false,
    focusable: false,
    data: { name: band.name, color: colorOf(band.name) },
  }));

  const flowEdges = edges
    .filter((edge) => !edge.crossBand || touchesFocused(edge))
    .map((edge) => {
      const highlighted = focused !== null && touchesFocused(edge);
      const dimmed = focused !== null && !highlighted;

      return {
        ...edge,
        animated: (rates.get(edge.source)?.throughputPerMinute ?? 0) > 0,
        markerEnd: { type: MarkerType.ArrowClosed },
        zIndex: highlighted ? 1 : 0,
        className: cn(
          highlighted && s.edgeHighlighted,
          dimmed && s.edgeDimmed,
          edge.crossBand && s.edgeCrossBand
        ),
      };
    });

  return (
    <section className={s.page}>
      <div className={s.canvas}>
        <ReactFlow
          nodes={[...bandNodes, ...nodes]}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeMouseEnter={(_event, node) => node.type === 'queueNode' && setFocused(node.id)}
          onNodeMouseLeave={() => setFocused(null)}
          onNodeClick={(_event, node) => {
            if (node.type === 'queueNode') {
              history.push(links.queuePage(node.id));
            }
          }}
          defaultViewport={INITIAL_VIEWPORT}
          minZoom={0.1}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
};
