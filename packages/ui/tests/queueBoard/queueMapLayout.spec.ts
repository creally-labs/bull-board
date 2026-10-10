import { layoutQueueMap } from '../../src/queueBoard/queueMapLayout';

describe('layoutQueueMap', () => {
  const queues = ['create', 'find', 'parse', 'analyze', 'download', 'inbound', 'process', 'idle'];
  const feeds = {
    create: ['find'],
    find: ['parse'],
    parse: ['analyze', 'download'],
    inbound: ['process'],
    process: ['analyze'],
    analyze: ['analyze'],
  };
  const bands: Record<string, string> = {
    create: 'Search',
    find: 'Search',
    parse: 'Search',
    analyze: 'Search',
    download: 'Search',
    inbound: 'Mail',
    process: 'Mail',
    idle: 'Mail',
  };

  const layout = layoutQueueMap(queues, feeds, (queue) => bands[queue]);
  const at = (queue: string) => layout.positions.get(queue)!;
  const edge = (id: string) => layout.edges.find((candidate) => candidate.id === id)!;

  it('places every queue right of the queues in its band that feed it', () => {
    layout.edges
      .filter(({ crossBand }) => !crossBand)
      .forEach(({ source, target }) => {
        expect(at(target).x).toBeGreaterThan(at(source).x);
      });
  });

  it('uses the longest feeding chain, not the shortest', () => {
    const longer = layoutQueueMap(['a', 'b', 'c'], { a: ['b', 'c'], b: ['c'] }, () => 'All');

    expect(longer.positions.get('c')!.x).toBeGreaterThan(longer.positions.get('b')!.x);
  });

  it('flags links between bands and lets them move nothing', () => {
    expect(edge('process->analyze').crossBand).toBe(true);
    expect(edge('parse->analyze').crossBand).toBe(false);
    expect(at('inbound').x).toBe(at('create').x);
    expect(at('process').x).toBe(at('find').x);
  });

  it('stacks one band per group in first-seen order and keeps each queue inside its band', () => {
    expect(layout.bands.map((band) => band.name)).toEqual(['Search', 'Mail']);

    queues.forEach((queue) => {
      const band = layout.bands.find(({ name }) => name === bands[queue])!;
      expect(at(queue).y).toBeGreaterThan(band.y);
      expect(at(queue).y).toBeLessThan(band.y + band.height);
    });
    expect(layout.bands[1].y).toBeGreaterThan(layout.bands[0].y + layout.bands[0].height);
  });

  it('drops self-loops and links to unknown queues', () => {
    const withUnknown = layoutQueueMap(['a'], { a: ['a', 'ghost'] }, () => 'All');

    expect(withUnknown.edges).toEqual([]);
    expect(layout.edges.map(({ id }) => id)).not.toContain('analyze->analyze');
  });

  it('survives a feeding cycle', () => {
    const cyclic = layoutQueueMap(['a', 'b'], { a: ['b'], b: ['a'] }, () => 'All');

    expect(cyclic.positions.size).toBe(2);
  });

  it('lays unlinked queues out in a row of their own below the chains', () => {
    const spread = layoutQueueMap(['a', 'b', 'c', 'x', 'y'], { a: ['b'], b: ['c'] }, () => 'All');
    const position = (queue: string) => spread.positions.get(queue)!;

    expect(new Set(['x', 'y'].map((queue) => position(queue).x)).size).toBe(2);
    expect(position('x').y).toBe(position('y').y);
    expect(position('x').y).toBeGreaterThan(position('a').y);
  });
});

it('puts a queue nothing feeds right before its nearest target', () => {
  const layout = layoutQueueMap(
    ['create', 'find', 'parse', 'enrich', 'analyze'],
    { create: ['find'], find: ['parse'], parse: ['analyze'], enrich: ['analyze'] },
    () => 'All'
  );
  const x = (queue: string) => layout.positions.get(queue)!.x;

  expect(x('enrich')).toBe(x('parse'));
  expect(x('create')).toBeLessThan(x('find'));
});
