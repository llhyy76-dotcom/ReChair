import ReChairLogo from './ReChairLogo';
import styles from './HeaderV072.module.css';

export default function Header() {
  return (
    <header className={`site-header rc-final-header ${styles.headerFix}`}>
      <div className={`header-inner rc-final-header-inner ${styles.innerFix}`}>
        <a href="/" className={`brand rc-final-brand ${styles.brandFix}`} aria-label="ReChair 홈">
          <ReChairLogo />
        </a>

        <nav className="desktop-nav rc-final-nav" aria-label="주요 메뉴">
          <a href="/#service-menu">서비스</a>
          <a href="/#products">중고상품</a>
          <a href="/rental">렌탈</a>
          <a href="/consult">무료상담</a>
          <a href="/admin">관리자</a>
        </nav>

        <a className={`header-cta rc-final-header-cta ${styles.ctaFix}`} href="/consult">
          상담 신청
        </a>

        <button className={`rc-final-menu ${styles.menuFix}`} type="button" aria-label="메뉴">
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
