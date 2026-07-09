export default function ReChairLogo() {
  return (
    <span className="rc-logo" aria-label="ReChair">
      <span className="rc-logo-words">
        <span className="rc-logo-re">Re</span>
        <span className="rc-logo-chair">Chair</span>
      </span>

      <span className="rc-logo-gears rc-mechanical-gears" aria-hidden="true">
        <svg className="rc-gear-svg rc-gear-main" viewBox="0 0 100 100">
          <path d="M50 4 L58 14 L70 10 L75 23 L88 24 L86 38 L96 46 L88 56 L92 70 L78 74 L74 88 L60 86 L50 96 L40 86 L26 88 L22 74 L8 70 L12 56 L4 46 L14 38 L12 24 L25 23 L30 10 L42 14 Z" />
          <circle cx="50" cy="50" r="24" />
          <circle cx="50" cy="50" r="12" />
        </svg>

        <svg className="rc-gear-svg rc-gear-sub" viewBox="0 0 100 100">
          <path d="M50 4 L58 14 L70 10 L75 23 L88 24 L86 38 L96 46 L88 56 L92 70 L78 74 L74 88 L60 86 L50 96 L40 86 L26 88 L22 74 L8 70 L12 56 L4 46 L14 38 L12 24 L25 23 L30 10 L42 14 Z" />
          <circle cx="50" cy="50" r="25" />
          <circle cx="50" cy="50" r="11" />
        </svg>
      </span>
    </span>
  );
}
