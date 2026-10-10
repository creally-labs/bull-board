import { render } from '@testing-library/react';
import { setQueueBoardConfig } from '../../src/queueBoard/config';
import { QueueRateBadge } from '../../src/queueBoard/QueueRateBadge';

afterEach(() => setQueueBoardConfig(undefined));

it('keeps a placeholder line for an unmeasured queue so every card has the same height', () => {
  setQueueBoardConfig({ queues: { parse: { group: 'Search', feeds: [] } } });

  const view = render(<QueueRateBadge queueName="parse" />);

  expect(view.getByText('no metrics')).toBeTruthy();
});

it('renders nothing on a board without queueBoard config', () => {
  const view = render(<QueueRateBadge queueName="parse" />);

  expect(view.container.textContent).toBe('');
});
