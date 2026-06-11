export default function Layout({ children, navigate }) {
  const go = (event, path) => {
    event.preventDefault();
    navigate(path);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={(event) => go(event, '/')}>
          <span className="brand-mark">IT</span>
          <span>
            <strong>AI Ticket Desk</strong>
            <small>สร้าง ticket จากข้อความ รูปภาพ และเอกสาร</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="หลัก">
          <a href="/" onClick={(event) => go(event, '/')}>
            เปิด ticket
          </a>
          <a href="/tickets" onClick={(event) => go(event, '/tickets')}>
            รายการ ticket
          </a>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
