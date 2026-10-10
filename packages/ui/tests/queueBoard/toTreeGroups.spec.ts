import type { AppQueue } from '@bull-board/api/typings/app';
import { setQueueBoardConfig } from '../../src/queueBoard/config';
import { toTree } from '../../src/utils/toTree';

const queue = (name: string) => ({ name, delimiter: '' }) as AppQueue;

afterEach(() => setQueueBoardConfig(undefined));

it('nests queues under their configured group path instead of splitting the name', () => {
  setQueueBoardConfig({
    queues: {
      'find-main': { group: 'Search/Task', feeds: [] },
      'profile-analyze': { group: 'Search/Creator analysis', feeds: [] },
    },
  });

  const tree = toTree([queue('find-main'), queue('profile-analyze'), queue('other')]);

  expect(tree.children.map((node) => node.name)).toEqual(['Search', 'other']);
  const search = tree.children[0];
  expect(search.children.map((node) => node.name)).toEqual(['Task', 'Creator analysis']);
  expect(search.children[0].children[0].queue?.name).toBe('find-main');
});
