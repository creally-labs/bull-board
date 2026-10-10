import { NavLink } from 'react-router-dom';
import { links } from '../utils/links';
import { getQueueBoardConfig, isQueueMapLocation } from './config';
import s from './ViewTabs.module.css';

export const ViewTabs = () => {
  if (!getQueueBoardConfig()) {
    return null;
  }

  return (
    <nav className={s.tabs}>
      <NavLink
        to={links.dashboardPage()}
        isActive={(_match, location) => location.pathname === '/' && !isQueueMapLocation(location)}
        className={s.tab}
        activeClassName={s.active}
      >
        Overview
      </NavLink>
      <NavLink
        to={links.queueMap()}
        isActive={(_match, location) => isQueueMapLocation(location)}
        className={s.tab}
        activeClassName={s.active}
      >
        Queue map
      </NavLink>
    </nav>
  );
};
