'use client';

import { useEffect, useMemo, useState } from 'react';

type DashboardData = {
  summary: Record<string,number>;
  consultation_status: {status:string;count:number}[];
  service_counts: {service_type:string;count:number}[];
  recent_consultations: any[];
  recent_products: any[];
};

const FILTERS = ['전체','신규','상담중','견적발송','예약완료','방문완료','판매완료','종료'];
const n = (v:number) => Number(v || 0).toLocaleString('ko-KR');
const won = (v:number) => `${n(v)}원`;

export default function AdminDashboard() {
  const [data,setData] = useState<DashboardData|null>(null);
  const [error,setError] = useState('');
  const [filter,setFilter] = useState('전체');

  async function load() {
    setError('');
    const res = await fetch('/api/admin/dashboard',{cache:'no-store'});
    const json = await res.json();
    if (!res.ok) { setError(json.error || '조회 오류'); return; }
    setData(json.data);
  }

  useEffect(() => { load(); }, []);

  const recent = useMemo(() => {
    if (!data) return [];
    return filter === '전체'
      ? data.recent_consultations
      : data.recent_consultations.filter(i => i.status === filter);
  },[data,filter]);

  if (error) return <div className="rc-dashboard-error"><b>대시보드를 불러오지 못했습니다.</b><p>{error}</p><button onClick={load}>다시 불러오기</button></div>;
  if (!data) return <div className="rc-dashboard-loading">운영 데이터를 불러오는 중입니다.</div>;

  const s = data.summary;
  const kpis = [
    ['전체 상담',s.total_consultations,'누적 접수'],
    ['신규',s.new_consultations,'확인 필요'],
    ['상담중',s.consulting_consultations,'상담 진행'],
    ['견적발송',s.quoted_consultations,'고객 회신 대기'],
    ['예약완료',s.reserved_consultations,'일정 확정'],
    ['방문완료',s.completed_consultations,'현장 업무 완료'],
    ['판매완료',s.sold_consultations,'판매 처리 완료'],
    ['종료',s.closed_consultations,'최종 종료'],
  ];

  return (
    <div className="rc-dashboard">
      <header className="rc-dashboard-head">
        <div><p>RECHAIR ADMIN</p><h1>운영 대시보드</h1><span>상담 상태를 중복 없이 구분합니다.</span></div>
        <button onClick={load}>새로고침</button>
      </header>

      <section className="rc-today-strip">
        <article><small>오늘 접수</small><strong>{n(s.today_consultations)}</strong></article>
        <article><small>오늘 완료</small><strong>{n(s.today_completed)}</strong></article>
        <article><small>오늘 견적</small><strong>{n(s.today_quotes)}</strong></article>
        <article><small>오늘 판매</small><strong>{n(s.today_sales)}</strong></article>
        <article className="dark"><small>이번 달 견적</small><strong>{won(s.month_estimate_amount)}</strong></article>
      </section>

      <section className="rc-dashboard-kpis">
        {kpis.map(([label,value,caption],idx) => (
          <article className={idx===1?'accent':''} key={String(label)}>
            <small>{label}</small><strong>{n(Number(value))}</strong><span>{caption}</span>
          </article>
        ))}
      </section>

      <section className="rc-dashboard-grid">
        <article className="rc-panel">
          <div className="rc-panel-head"><div><p>CONSULTATION STATUS</p><h2>상담 처리상태</h2></div><a href="/admin/consultations">상담 CRM 열기 ›</a></div>
          <div className="rc-status-grid">{data.consultation_status.map(i => <div key={i.status}><span>{i.status}</span><strong>{n(i.count)}</strong></div>)}</div>
        </article>

        <article className="rc-panel">
          <div className="rc-panel-head"><div><p>SERVICE ANALYSIS</p><h2>서비스별 접수</h2></div></div>
          <div className="rc-service-list">{data.service_counts.map(i => <div key={i.service_type}><span>{i.service_type}</span><strong>{n(i.count)}</strong></div>)}</div>
        </article>
      </section>

      <section className="rc-dashboard-grid">
        <article className="rc-panel">
          <div className="rc-panel-head"><div><p>RECENT CONSULTATIONS</p><h2>최근 상담</h2></div></div>
          <div className="rc-filter-row">{FILTERS.map(v => <button className={filter===v?'active':''} onClick={()=>setFilter(v)} key={v}>{v}</button>)}</div>
          <div className="rc-list">
            {recent.length===0 ? <p>해당 상태의 상담이 없습니다.</p> : recent.map(i => (
              <a href={`/admin/consultations?id=${i.id}`} key={i.id}>
                <div><b>{i.customer_name}</b><span>{i.phone}</span><em>{i.product_title || `${i.brand||''} ${i.model_name||''}`.trim() || '상품 미지정'}</em></div>
                <div><strong>{i.service_type}</strong><small>{i.status}</small></div>
              </a>
            ))}
          </div>
        </article>

        <article className="rc-panel">
          <div className="rc-panel-head"><div><p>PRODUCT STATUS</p><h2>판매상품 현황</h2></div><a href="/admin/products">상품관리 열기 ›</a></div>
          <div className="rc-product-summary">
            <div><span>전체</span><strong>{n(s.total_products)}</strong></div>
            <div><span>판매중</span><strong>{n(s.selling_products)}</strong></div>
            <div><span>예약중</span><strong>{n(s.reserved_products)}</strong></div>
            <div><span>판매완료</span><strong>{n(s.sold_out_products)}</strong></div>
            <div><span>숨김</span><strong>{n(s.hidden_products)}</strong></div>
          </div>
          <div className="rc-products">{data.recent_products.map(p => (
            <a href={`/products/${p.id}`} target="_blank" key={p.id}>
              <div>{p.thumbnail_url?<img src={p.thumbnail_url} alt={p.title}/>:<span>💺</span>}</div>
              <section><b>{p.title}</b><small>{p.brand} · {p.model_name}</small><strong>{won(p.price)}</strong></section>
              <em>{p.status}</em>
            </a>
          ))}</div>
        </article>
      </section>
    </div>
  );
}
