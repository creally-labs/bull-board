import { render, waitFor } from '@testing-library/react';
import { useQueues } from '../../src/hooks/useQueues';
import { useSettingsStore } from '../../src/hooks/useSettings';
import { setQueueBoardConfig } from '../../src/queueBoard/config';
import { QueueRatesProvider, useQueueRate } from '../../src/queueBoard/QueueRatesProvider';
import { createWrapper, makeQueue } from '../testUtils';

const metrics = {
  meta: { count: 30, prevTS: Date.now() - 120_000, prevCount: 0 },
  data: [],
  count: 0,
};

const RateProbe = () => {
  const { queues } = useQueues();
  const rate = useQueueRate('parse');
  return <span>{`${queues?.length ?? 0} queues, ${rate ? 'measured' : 'unmeasured'}`}</span>;
};

function renderProvider() {
  const api = {
    getQueues: jest.fn(async () => ({ queues: [makeQueue('parse')] })),
    getMetrics: jest.fn(async () => ({ completed: metrics, failed: null })),
  };
  const { Wrapper } = createWrapper({ api });
  const view = render(
    <Wrapper>
      <QueueRatesProvider>
        <RateProbe />
      </QueueRatesProvider>
    </Wrapper>
  );

  return { api, view };
}

beforeEach(() => {
  useSettingsStore.setState({ pollingInterval: 0, jobsPerPage: 10 });
});

afterEach(() => setQueueBoardConfig(undefined));

it('does not fetch metrics on a board without queueBoard config', async () => {
  const { api, view } = renderProvider();

  await waitFor(() => expect(view.getByText('1 queues, unmeasured')).toBeTruthy());
  expect(api.getMetrics).not.toHaveBeenCalled();
});

it('measures every queue once queueBoard config is present', async () => {
  setQueueBoardConfig({ queues: { parse: { group: 'Search', feeds: [] } } });

  const { api, view } = renderProvider();

  await waitFor(() => expect(view.getByText('1 queues, measured')).toBeTruthy());
  expect(api.getMetrics).toHaveBeenCalledWith('parse');
});
