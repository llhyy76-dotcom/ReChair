import ReChairLogo from './ReChairLogo';

export default function Header() {
  return (
    <header className="site-header rc-final-header">
      <div className="header-inner rc-final-header-inner">
        <a href="/" className="brand rc-final-brand" aria-label="ReChair 홈"><ReChairLogo /></a>
        <nav className="desktop-nav rc-final-nav" aria-label="주요 메뉴">
          <a href="#service-menu">서비스</a>
          <a href="#how">이용 방법</a>
          <a href="#consult">고객센터</a>
          <a href="#about">회사 소개</a>
        </nav>
        <a className="header-cta rc-final-header-cta" href="#consult">상담 신청</a>
        <button className="rc-final-menu" type="button" aria-label="메뉴"><span /><span /><span /></button>
      </div>
    </header>
  );
}
