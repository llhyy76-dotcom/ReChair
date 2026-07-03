export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#" className="text-2xl font-black tracking-tight text-slate-950">
          Re<span className="text-brand">Chair</span>
        </a>
        <nav className="hidden gap-7 text-sm font-bold text-slate-700 md:flex">
          <a href="#services">서비스</a>
          <a href="#products">중고상품</a>
          <a href="#consult">무료상담</a>
          <a href="/admin">관리자</a>
        </nav>
        <a href="#consult" className="rounded-full bg-brand px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20">
          상담 신청
        </a>
      </div>
    </header>
  );
}
