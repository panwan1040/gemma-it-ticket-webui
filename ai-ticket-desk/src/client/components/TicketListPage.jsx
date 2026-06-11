import { useEffect, useState } from 'react';
import { listTickets } from '../lib/api.js';
import { formatDateTime, statuses } from '../lib/format.js';
import ErrorMessage from './ErrorMessage.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function TicketListPage({ navigate }) {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listTickets({ search, status })
      .then((data) => {
        if (alive) setTickets(data);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'โหลดรายการ ticket ไม่สำเร็จ');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [search, status]);

  const openTicket = (event, id) => {
    event.preventDefault();
    navigate(`/tickets/${encodeURIComponent(id)}`);
  };

  return (
    <div className="content-grid">
      <section className="section-heading">
        <h1>รายการ ticket</h1>
        <div className="heading-actions">
          <a className="secondary-button" href="/api/tickets-export.csv">
            Export CSV
          </a>
          <a className="secondary-button" href="/api/tickets-export.json">
            Export JSON
          </a>
          <button className="secondary-button" onClick={() => navigate('/')}>
            เปิด ticket ใหม่
          </button>
        </div>
      </section>

      <section className="card stack">
        <div className="filters">
          <label>
            <span>ค้นหา</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาจากรหัส หัวข้อ หรือสรุปปัญหา" />
          </label>
          <label>
            <span>สถานะ</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">ทั้งหมด</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ErrorMessage message={error} />
        {loading ? <p className="muted">กำลังโหลดรายการ...</p> : null}

        {!loading && tickets.length === 0 ? <p className="muted">ยังไม่มี ticket ที่ตรงกับเงื่อนไข</p> : null}

        {tickets.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>หัวข้อ</th>
                  <th>สถานะ</th>
                  <th>หมวดหมู่</th>
                  <th>ความสำคัญ</th>
                  <th>สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <a href={`/tickets/${ticket.id}`} onClick={(event) => openTicket(event, ticket.id)}>
                        {ticket.id}
                      </a>
                    </td>
                    <td>{ticket.title}</td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>{ticket.category}</td>
                    <td>{ticket.priority}</td>
                    <td>{formatDateTime(ticket.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
