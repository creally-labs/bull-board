import { Tooltip } from '@base-ui/react/tooltip';
import React, { Suspense, useEffect } from 'react';
import { Route, Switch, useLocation } from 'react-router-dom';
import { ConfirmModal } from './components/ConfirmModal/ConfirmModal';
import { Header } from './components/Header/Header';
import { HeaderActions } from './components/HeaderActions/HeaderActions';
import { Loader } from './components/Loader/Loader';
import { Menu } from './components/Menu/Menu';
import { SidebarToggle } from './components/SidebarToggle/SidebarToggle';
import { Title } from './components/Title/Title';
import { Toaster } from './components/Toaster/Toaster';
import { useConfirm } from './hooks/useConfirm';
import { useDarkMode } from './hooks/useDarkMode';
import { useLanguageWatch } from './hooks/useLanguageWatch';
import { useMobileQuery } from './hooks/useMobileQuery';
import { useScrollTopOnNav } from './hooks/useScrollTopOnNav';
import { useSearchHotkey } from './hooks/useSearchHotkey';
import { useSettingsStore } from './hooks/useSettings';
import { isQueueMapLocation } from './queueBoard/config';
import { QueueRatesProvider } from './queueBoard/QueueRatesProvider';
import { ViewTabs } from './queueBoard/ViewTabs';

const JobPageLazy = React.lazy(() =>
  import('./pages/JobPage/JobPage').then(({ JobPage }) => ({ default: JobPage }))
);

const QueuePageLazy = React.lazy(() =>
  import('./pages/QueuePage/QueuePage').then(({ QueuePage }) => ({ default: QueuePage }))
);

const OverviewPageLazy = React.lazy(() =>
  import('./pages/OverviewPage/OverviewPage').then(({ OverviewPage }) => ({
    default: OverviewPage,
  }))
);

const MetricsHistoryPageLazy = React.lazy(() =>
  import('./pages/MetricsHistoryPage/MetricsHistoryPage').then(({ MetricsHistoryPage }) => ({
    default: MetricsHistoryPage,
  }))
);

const QueueMapPageLazy = React.lazy(() =>
  import('./queueBoard/QueueMapPage').then(({ QueueMapPage }) => ({ default: QueueMapPage }))
);

const SchedulersPageLazy = React.lazy(() =>
  import('./pages/SchedulersPage/SchedulersPage').then(({ SchedulersPage }) => ({
    default: SchedulersPage,
  }))
);

export const App = () => {
  useScrollTopOnNav();
  const { confirmProps } = useConfirm();
  const isMobile = useMobileQuery();
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const isQueueMapView = isQueueMapLocation(useLocation());
  useLanguageWatch();
  useDarkMode();
  useSearchHotkey();

  useEffect(() => {
    document.body.dataset.sidebarCollapsed = String(!isMobile && sidebarCollapsed);
    requestAnimationFrame(() => document.body.classList.remove('preload'));
    return () => {
      delete document.body.dataset.sidebarCollapsed;
    };
  }, [isMobile, sidebarCollapsed]);

  return (
    <Tooltip.Provider delay={400} closeDelay={100}>
      <QueueRatesProvider>
        <Header>
          <div className="header-title-group">
            {!isMobile && <SidebarToggle />}
            <ViewTabs />
            <Title />
          </div>
          <HeaderActions />
        </Header>
        {!isMobile && <Menu />}
        <main>
          <div>
            <Suspense fallback={<Loader />}>
              <Switch>
                <Route path="/queue/:name/:jobId" render={() => <JobPageLazy />} />
                <Route path="/queue/:name" render={() => <QueuePageLazy />} />
                <Route path="/metrics-history" exact render={() => <MetricsHistoryPageLazy />} />
                <Route path="/job-schedulers" exact render={() => <SchedulersPageLazy />} />

                <Route
                  path="/"
                  exact
                  render={() => (isQueueMapView ? <QueueMapPageLazy /> : <OverviewPageLazy />)}
                />
              </Switch>
            </Suspense>
            <ConfirmModal {...confirmProps} />
          </div>
        </main>
        <Toaster />
      </QueueRatesProvider>
    </Tooltip.Provider>
  );
};
