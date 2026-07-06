export default function Header() {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <a className="logo" href="/">Re<span>Chair</span></a>
        <nav className="nav-links">
          <a href="#services">서비스</a>
          <a href="#products">중고상품</a>
          <a href="#consult">무료상담</a>
          <a href="/admin">관리자</a>
          <a className="nav-cta" href="#consult">상담 신청</a>
        </nav>
      </div>
    </header>
  )
}
