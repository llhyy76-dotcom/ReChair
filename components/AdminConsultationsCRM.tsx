'use client';
import {useEffect,useState} from 'react';

const STATUS=['신규','상담중','견적발송','예약완료','방문완료','판매완료','종료'];
const SERVICE=['전체','중고구매','중고판매','이전설치','폐기수거','출장수리','부품구매'];

export default function AdminConsultationsCRM(){
  const [rows,setRows]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [status,setStatus]=useState('전체');
  const [service,setService]=useState('전체');
  const [q,setQ]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    const p=new URLSearchParams();
    if(status!=='전체')p.set('status',status);
    if(service!=='전체')p.set('service',service);
    if(q.trim())p.set('q',q.trim());
    const r=await fetch('/api/admin/consultations?'+p.toString(),{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'조회 오류');return;}
    setRows(j.data||[]);
  }
  useEffect(()=>{load()},[status,service]);

  async function save(){
    if(!selected)return;
    const r=await fetch('/api/admin/consultations/'+selected.id,{
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(selected)
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'저장 오류');return;}
    setSelected(j.data);setMessage('저장되었습니다.');load();
  }

  const patch=(k:string,v:any)=>setSelected((s:any)=>({...s,[k]:v}));
  const photos=selected?[['앞면',selected.photo_front_url],['측면',selected.photo_side_url],['라벨',selected.photo_label_url],['후면',selected.photo_back_url]]:[];

  return <div className="crm">
    <header><div><p>RECHAIR ADMIN</p><h1>상담 CRM</h1><span>상담 접수부터 완료까지 관리합니다.</span></div><a href="/admin/dashboard">운영 대시보드 ›</a></header>

    <div className="toolbar">
      <div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="이름, 연락처, 지역, 모델명 검색" onKeyDown={e=>e.key==='Enter'&&load()}/><button onClick={load}>검색</button></div>
      <select value={service} onChange={e=>setService(e.target.value)}>{SERVICE.map(v=><option key={v}>{v}</option>)}</select>
    </div>

    <nav><button className={status==='전체'?'on':''} onClick={()=>setStatus('전체')}>전체</button>{STATUS.map(v=><button className={status===v?'on':''} onClick={()=>setStatus(v)} key={v}>{v}</button>)}</nav>
    {message&&<aside>{message}</aside>}

    <main>
      <section className="list">{rows.length?rows.map(r=><button className={selected?.id===r.id?'on':''} onClick={()=>setSelected(r)} key={r.id}>
        <div><b>{r.customer_name||'이름 없음'}</b><span>{r.phone}</span><em>{r.region||'지역 미입력'}</em></div>
        <div><strong>{r.service_type}</strong><small>{r.status}</small></div>
      </button>):<p>조건에 맞는 상담이 없습니다.</p>}</section>

      <section className="detail">{!selected?<div className="empty"><b>상담을 선택하세요.</b><p>왼쪽 목록에서 상담을 선택합니다.</p></div>:<>
        <div className="title"><div><p>{selected.service_type}</p><h2>{selected.customer_name}</h2><span>{selected.phone} · {selected.region||'지역 미입력'}</span></div><a href={'tel:'+selected.phone}>전화하기</a></div>
        <div className="fields">
          <label><span>처리상태</span><select value={selected.status} onChange={e=>patch('status',e.target.value)}>{STATUS.map(v=><option key={v}>{v}</option>)}</select></label>
          <label><span>담당자</span><input value={selected.assignee||''} onChange={e=>patch('assignee',e.target.value)} placeholder="담당자"/></label>
          <label><span>견적금액</span><input type="number" value={selected.estimate_amount||0} onChange={e=>patch('estimate_amount',Number(e.target.value))}/></label>
          <label><span>다음 일정</span><input type="datetime-local" value={selected.next_action_at?selected.next_action_at.slice(0,16):''} onChange={e=>patch('next_action_at',e.target.value||null)}/></label>
        </div>
        <div className="product"><div><span>브랜드</span><b>{selected.brand||'-'}</b></div><div><span>모델명</span><b>{selected.model_name||'-'}</b></div><div><span>연결상품</span><b>{selected.product_title||'-'}</b></div></div>
        <label className="memo"><span>관리자 메모</span><textarea value={selected.memo||''} onChange={e=>patch('memo',e.target.value)} placeholder="통화내용과 후속조치를 기록하세요."/></label>
        <div className="photos">{photos.map(([n,u])=><div key={n}><b>{n}</b>{u?<a href={u} target="_blank"><img src={u} alt={n}/></a>:<p>사진 없음</p>}</div>)}</div>
        <footer><button onClick={save}>변경사항 저장</button></footer>
      </>}</section>
    </main>
  </div>
}
