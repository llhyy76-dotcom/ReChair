import ReChairLogo from './ReChairLogo';

export default function Header() {
  return (
    <header className="site-header rechair-new-header">
      <div className="header-inner">
        <a href="/" className="brand" aria-label="ReChair 홈">
          <ReChairLogo />
        </a>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          <a href="#services">서비스</a>
          <a href="#products">중고상품</a>
          <a href="#consult">무료상담</a>
          <a href="/admin">관리자</a>
        </nav>

        <a className="header-cta" href="#consult">상담 신청</a>

        <button className="mobile-menu-button" type="button" aria-label="메뉴">
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
