export const MAP_NODE_WIDTH = 250;
export const MAP_NODE_HEIGHT = 128;

const COLUMN_STRIDE = MAP_NODE_WIDTH + 90;
const ROW_STRIDE = MAP_NODE_HEIGHT + 20;
const BAND_PADDING = 24;
const BAND_LABEL_HEIGHT = 28;
const BAND_GAP = 28;
const BARYCENTER_SWEEPS = 4;
const MIN_COLUMNS = 4;

export interface QueueMapEdge {
  id: string;
  source: string;
  target: string;
  crossBand: boolean;
}

export interface QueueMapBand {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QueueMapLayout {
  positions: Map<string, { x: number; y: number }>;
  edges: QueueMapEdge[];
  bands: QueueMapBand[];
}

function longestChainLayers(
  queues: string[],
  feeders: Map<string, string[]>,
  targets: Map<string, string[]>
): Map<string, number> {
  const layers = new Map<string, number>();

  const layerOf = (queue: string, visiting: Set<string>): number => {
    const cached = layers.get(queue);
    if (cached !== undefined) {
      return cached;
    }

    visiting.add(queue);
    const upstream = (feeders.get(queue) ?? []).filter((feeder) => !visiting.has(feeder));
    const layer = upstream.length
      ? 1 + Math.max(...upstream.map((feeder) => layerOf(feeder, visiting)))
      : 0;
    visiting.delete(queue);
    layers.set(queue, layer);

    return layer;
  };

  queues.forEach((queue) => layerOf(queue, new Set()));

  queues
    .filter((queue) => !feeders.get(queue)?.length && targets.get(queue)?.length)
    .forEach((source) => {
      const nearestTarget = Math.min(...targets.get(source)!.map((target) => layers.get(target)!));
      layers.set(source, Math.max(0, nearestTarget - 1));
    });

  return layers;
}

function orderColumns(
  columns: string[][],
  feeders: Map<string, string[]>,
  targets: Map<string, string[]>
): void {
  const rowOf = new Map<string, number>();
  const indexRows = (column: string[]) => column.forEach((queue, row) => rowOf.set(queue, row));
  columns.forEach(indexRows);

  const reorder = (column: string[], neighbours: Map<string, string[]>) => {
    const barycenter = (queue: string) => {
      const rows = (neighbours.get(queue) ?? [])
        .map((neighbour) => rowOf.get(neighbour))
        .filter((row): row is number => row !== undefined);
      return rows.length
        ? rows.reduce((sum, row) => sum + row, 0) / rows.length
        : rowOf.get(queue)!;
    };
    column.sort((left, right) => barycenter(left) - barycenter(right));
    indexRows(column);
  };

  for (let sweep = 0; sweep < BARYCENTER_SWEEPS; sweep += 1) {
    columns.slice(1).forEach((column) => reorder(column, feeders));
    columns
      .slice(0, -1)
      .reverse()
      .forEach((column) => reorder(column, targets));
  }
}

/**
 * Stacks one horizontal band per group and lays each band out on its own links only: a queue sits
 * in the column of the longest chain inside its band that feeds it (a queue nothing feeds sits
 * right before its nearest target), columns are ordered by the
 * average row of their neighbours, and queues without links inside the band fill rows of their
 * own below the chains. Links between bands do not move anything.
 */
export function layoutQueueMap(
  queues: string[],
  feeds: Record<string, string[]>,
  bandOf: (queue: string) => string
): QueueMapLayout {
  const known = new Set(queues);
  const edges: QueueMapEdge[] = queues.flatMap((source) =>
    (feeds[source] ?? [])
      .filter((target) => known.has(target) && target !== source)
      .map((target) => ({
        id: `${source}->${target}`,
        source,
        target,
        crossBand: bandOf(source) !== bandOf(target),
      }))
  );

  const feeders = new Map<string, string[]>(queues.map((queue) => [queue, []]));
  const targets = new Map<string, string[]>(queues.map((queue) => [queue, []]));
  edges
    .filter((edge) => !edge.crossBand)
    .forEach(({ source, target }) => {
      feeders.get(target)?.push(source);
      targets.get(source)?.push(target);
    });

  const layers = longestChainLayers(queues, feeders, targets);
  const isLinked = (queue: string) => feeders.get(queue)!.length + targets.get(queue)!.length > 0;

  const bandNames = [...new Set(queues.map(bandOf))];
  const bandLayouts = bandNames.map((name) => {
    const bandQueues = queues.filter((queue) => bandOf(queue) === name);
    const linked = bandQueues.filter(isLinked);
    const layerCount = linked.length
      ? 1 + Math.max(...linked.map((queue) => layers.get(queue)!))
      : 0;
    const columns: string[][] = Array.from({ length: layerCount }, () => []);

    linked.forEach((queue) => columns[layers.get(queue)!].push(queue));
    orderColumns(columns, feeders, targets);

    return { name, columns, unlinked: bandQueues.filter((queue) => !isLinked(queue)) };
  });

  const columnCount = Math.max(MIN_COLUMNS, ...bandLayouts.map(({ columns }) => columns.length));
  const width = (columnCount - 1) * COLUMN_STRIDE + MAP_NODE_WIDTH + 2 * BAND_PADDING;
  const positions = new Map<string, { x: number; y: number }>();
  const bands: QueueMapBand[] = [];
  let top = 0;

  bandLayouts.forEach(({ name, columns, unlinked }) => {
    const linkedRows = Math.max(0, ...columns.map((column) => column.length));
    const rows = linkedRows + Math.ceil(unlinked.length / columnCount);
    const place = (queue: string, column: number, row: number) =>
      positions.set(queue, {
        x: BAND_PADDING + column * COLUMN_STRIDE,
        y: top + BAND_LABEL_HEIGHT + BAND_PADDING + row * ROW_STRIDE,
      });

    columns.forEach((column, layer) => column.forEach((queue, row) => place(queue, layer, row)));
    unlinked.forEach((queue, index) =>
      place(queue, index % columnCount, linkedRows + Math.floor(index / columnCount))
    );

    const height =
      BAND_LABEL_HEIGHT + rows * ROW_STRIDE - (ROW_STRIDE - MAP_NODE_HEIGHT) + 2 * BAND_PADDING;
    bands.push({ name, x: 0, y: top, width, height });
    top += height + BAND_GAP;
  });

  return { positions, edges, bands };
}
