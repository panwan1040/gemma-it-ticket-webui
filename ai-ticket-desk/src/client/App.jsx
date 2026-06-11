import { useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import IntakePage from './components/IntakePage.jsx';
import TicketListPage from './components/TicketListPage.jsx';
import TicketDetailPage from './components/TicketDetailPage.jsx';

function readRoute() {
  const { pathname } = window.location;
  const detailMatch = pathname.match(/^\/tickets\/([^/]+)$/);
  if (detailMatch) return { name: 'ticket-detail', id: decodeURIComponent(detailMatch[1]) };
  if (pathname === '/tickets') return { name: 'tickets' };
  return { name: 'intake' };
}

export default function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to) => {
    window.history.pushState({}, '', to);
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const page = useMemo(() => {
    if (route.name === 'tickets') return <TicketListPage navigate={navigate} />;
    if (route.name === 'ticket-detail') return <TicketDetailPage id={route.id} navigate={navigate} />;
    return <IntakePage navigate={navigate} />;
  }, [route]);

  return <Layout navigate={navigate}>{page}</Layout>;
}
