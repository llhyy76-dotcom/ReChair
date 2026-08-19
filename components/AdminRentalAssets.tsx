'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';

const STATUSES=['전체','렌탈가능','배정완료','설치예약','렌탈중','회수예정','점검중','정비중','폐기검토','폐기완료'];
const MANUAL_STATUSES=['렌탈가능','점검중','정비중','폐기검토','폐기완료'];
const LOCATIONS=['창고','고객설치','기사보관','정비처','폐기','기타'];
const GRADES=['S급','A급','B급','C급','정비필요'];

type Asset={
  id:string;asset_no:string;product_id?:string|null;serial_number?:string|null;
  title:string;brand?:string|null;model_name?:string|null;rental_type?:string|null;
  status:string;condition_grade:string;location_type:string;location_text?:string|null;
  acquired_at?:string|null;acquisition_cost?:number|null;memo?:string|null;
  updated_at?:string|null;customer?:any;
};

const emptyForm={
  product_id:'',asset_no:'',serial_number:'',status:'렌탈가능',condition_grade:'A급',
  location_type:'창고',location_text:'',acquired_at:'',acquisition_cost:0,memo:'',
};

function rentalType(value:unknown){
  return value==='commercial'?'영업용·코인형':'개인용';
}

function dateTime(value:unknown){
  const parsed=new Date(String(value||''));
  return Number.isNaN(parsed.getTime())?'-':parsed.toLocaleString('ko-KR');
}

export default function AdminRentalAssets(){
  const [assets,setAssets]=useState<Asset[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [summary,setSummary]=useState<any>({});
  const [status,setStatus]=useState('전체');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<Asset|null>(null);
  const [events,setEvents]=useState<any[]>([]);
  const [form,setForm]=useState({...emptyForm});
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'error'|'working'>('success');

  const notify=(text:string,nextTone:'success'|'error'|'working'='success')=>{
    setMessage(text);setTone(nextTone);
  };

  async function body(response:Response){
    const text=await response.text();
    if(!text)return {};
    try{return JSON.parse(text)}catch{return {error:`서버 응답 오류 (HTTP ${response.status})`}}
  }

  const load=useCallback(async(keepId?:string)=>{
    try{
      setLoading(true);
      const response=await fetch('/api/admin/rental/assets',{cache:'no-store'});
      const result=await body(response);
      if(!response.ok){notify(result.error||'렌탈 자산대장 조회 오류','error');return;}
      setAssets(result.data||[]);
      setProducts(result.products||[]);
      setSummary(result.summary||{});
      if(keepId){
        const next=(result.data||[]).find((item:Asset)=>item.id===keepId)||null;
        setSelected(next);
      }
    }catch(error){
      console.error('rental assets load error',error);
      notify('렌탈 자산대장을 불러오지 못했습니다.','error');
    }finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  const filtered=useMemo(()=>assets.filter(asset=>{
    if(status!=='전체'&&asset.status!==status)return false;
    const needle=query.trim().toLowerCase();
    if(!needle)return true;
    return [asset.asset_no,asset.serial_number,asset.title,asset.brand,asset.model_name,
      asset.location_text,asset.customer?.customer_name,asset.customer?.name]
      .some(value=>String(value||'').toLowerCase().includes(needle));
  }),[assets,status,query]);

  function select(asset:Asset){
    setSelected(asset);
    setEvents([]);
    setForm({
      product_id:asset.product_id||'',asset_no:asset.asset_no||'',
      serial_number:asset.serial_number||'',status:asset.status,
      condition_grade:asset.condition_grade||'A급',location_type:asset.location_type||'창고',
      location_text:asset.location_text||'',acquired_at:String(asset.acquired_at||'').slice(0,10),
      acquisition_cost:Number(asset.acquisition_cost||0),memo:asset.memo||'',
    });
    void (async()=>{
      try{
        const response=await fetch(`/api/admin/rental/assets/${asset.id}`,{cache:'no-store'});
        const result=await body(response);
        if(response.ok)setEvents(result.events||[]);
      }catch(error){console.error('rental asset history load error',error)}
    })();
  }

  function createNew(productId=''){
    setSelected(null);
    setEvents([]);
    setForm({...emptyForm,product_id:productId});
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function save(){
    if(!form.product_id){notify('렌탈 상품을 선택해 주세요.','error');return;}
    try{
      setSaving(true);notify(selected?'자산 정보를 저장하고 있습니다.':'새 자산을 등록하고 있습니다.','working');
      const response=await fetch(
        selected?`/api/admin/rental/assets/${selected.id}`:'/api/admin/rental/assets',
        {
          method:selected?'PATCH':'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({...form,action:'create'}),
        }
      );
      const result=await body(response);
      if(!response.ok){notify(result.error||'렌탈 자산 저장 오류','error');return;}
      notify(selected?'자산 정보가 저장되었습니다.':'새 렌탈 자산이 등록되었습니다.','success');
      await load(result.data?.id||selected?.id);
      if(result.data)select(result.data);
    }catch(error){
      console.error('rental asset save error',error);
      notify('렌탈 자산을 저장하지 못했습니다.','error');
    }finally{setSaving(false)}
  }

  async function activate(product:any){
    if(!window.confirm(
      `'${product.title||product.name||'렌탈 상품'}'의 재고·노출 상태를 개별 자산대장 기준으로 관리할까요?\n\n실물 보유 수량을 모두 등록한 뒤 적용해야 합니다.`
    ))return;
    try{
      setSaving(true);notify('상품에 개별 자산관리를 적용하고 있습니다.','working');
      const response=await fetch('/api/admin/rental/assets',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'activate_product',product_id:product.id}),
      });
      const result=await body(response);
      if(!response.ok){notify(result.error||'개별 자산관리 적용 오류','error');return;}
      notify('개별 자산관리가 적용되었습니다. 이제 계약마다 실물 자산을 배정할 수 있습니다.','success');
      await load(selected?.id);
    }catch(error){
      console.error('rental asset management activation error',error);
      notify('개별 자산관리를 적용하지 못했습니다.','error');
    }finally{setSaving(false)}
  }

  const activeLocked=Boolean(selected&&['배정완료','설치예약','렌탈중','회수예정'].includes(selected.status));

  return <main className="rental-assets-page">
    <section className="rental-assets-shell">
      <header className="rental-assets-title">
        <div><p>RECHAIR RENTAL ASSETS</p><h1>개별 렌탈 자산대장</h1><span>안마의자 한 대마다 자산번호·제조번호·설치·회수 상태를 추적합니다.</span></div>
        <nav><a href="/admin/rental">상담·계약</a><a href="/admin/rental/operations">납부·회수</a></nav>
      </header>

      <section className="rental-asset-summary">
        <button onClick={()=>setStatus('전체')} className={status==='전체'?'on':''}><span>전체 자산</span><b>{summary.total||0}</b></button>
        <button onClick={()=>setStatus('렌탈가능')} className={status==='렌탈가능'?'on':''}><span>렌탈 가능</span><b>{summary.available||0}</b></button>
        <button onClick={()=>setStatus('배정완료')} className={status==='배정완료'?'on':''}><span>계약 배정</span><b>{summary.assigned||0}</b></button>
        <button onClick={()=>setStatus('설치예약')} className={status==='설치예약'?'on':''}><span>설치 예약</span><b>{summary.installation||0}</b></button>
        <button onClick={()=>setStatus('렌탈중')} className={status==='렌탈중'?'on':''}><span>고객 사용 중</span><b>{summary.operating||0}</b></button>
        <button onClick={()=>setStatus('회수예정')} className={status==='회수예정'?'on':''}><span>회수 예정</span><b>{summary.retrieval||0}</b></button>
        <button onClick={()=>setStatus('점검중')} className={status==='점검중'||status==='정비중'?'on':''}><span>점검·정비</span><b>{summary.maintenance||0}</b></button>
      </section>

      {message&&<aside className="rental-asset-message" data-tone={tone}><b>{tone==='error'?'!':tone==='working'?'…':'✓'}</b><span>{message}</span><button onClick={()=>setMessage('')}>×</button></aside>}

      <section className="rental-product-assets">
        <header><div><p>PRODUCT MIGRATION</p><h2>상품별 자산관리 적용</h2><span>실물 수량을 먼저 모두 등록한 뒤 적용하세요. 적용 후 재고와 판매 노출은 자산 상태로 자동 계산됩니다.</span></div></header>
        <div>{products.map(product=><article key={product.id} data-managed={product.rental_asset_managed?'true':'false'}>
          <div><b>{product.title||product.name||'렌탈 상품'}</b><span>{rentalType(product.rental_type)} · 등록 {product.asset_count||0}대 · 렌탈가능 {product.available_count||0}대</span></div>
          <div>{product.rental_asset_managed?<em>자산관리 적용됨</em>:<><button onClick={()=>createNew(product.id)}>자산 등록</button><button disabled={saving||!product.asset_count} onClick={()=>void activate(product)}>관리 적용</button></>}</div>
        </article>)}</div>
      </section>

      <section className="rental-asset-workspace">
        <div className="rental-asset-list">
          <header><div><b>{status}</b><span>{filtered.length}대</span></div><button onClick={()=>createNew()}>+ 새 자산</button></header>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="자산번호·제조번호·상품·고객 검색"/>
          <div>{filtered.length?filtered.map(asset=><button key={asset.id} onClick={()=>select(asset)} className={selected?.id===asset.id?'selected':''}>
            <div><strong>{asset.asset_no}</strong><em data-status={asset.status}>{asset.status}</em></div>
            <b>{asset.title}</b><span>{asset.brand||'-'} · {asset.model_name||'-'} · 제조번호 {asset.serial_number||'미입력'}</span>
            <footer><small>{asset.customer?.customer_name||asset.customer?.name||asset.location_text||asset.location_type}</small><small>{asset.condition_grade}</small></footer>
          </button>):<p className="rental-asset-empty">조건에 맞는 자산이 없습니다.</p>}</div>
        </div>

        <div className="rental-asset-editor">
          <header><div><p>{selected?'ASSET DETAIL':'NEW RENTAL ASSET'}</p><h2>{selected?'개별 자산 정보':'새 실물 자산 등록'}</h2></div>{selected&&<em data-status={selected.status}>{selected.status}</em>}</header>
          {activeLocked&&<p className="rental-asset-lock">이 자산은 계약에 연결되어 있습니다. 상태는 설치·회수 업무 진행에 따라 자동 변경됩니다.</p>}
          <div className="rental-asset-fields">
            <label className="wide"><span>연결 렌탈 상품</span><select value={form.product_id} disabled={activeLocked} onChange={event=>setForm({...form,product_id:event.target.value})}><option value="">상품을 선택하세요</option>{products.map(product=><option key={product.id} value={product.id}>{product.title||product.name} · {rentalType(product.rental_type)}</option>)}</select></label>
            <label><span>자산번호</span><input value={form.asset_no} onChange={event=>setForm({...form,asset_no:event.target.value})} placeholder="비워두면 자동 생성"/></label>
            <label><span>제조번호·시리얼</span><input value={form.serial_number} onChange={event=>setForm({...form,serial_number:event.target.value})} placeholder="제품 라벨의 고유번호"/></label>
            <label><span>자산 상태</span><select value={form.status} disabled={activeLocked} onChange={event=>setForm({...form,status:event.target.value})}>{activeLocked?<option>{form.status}</option>:MANUAL_STATUSES.map(item=><option key={item}>{item}</option>)}</select></label>
            <label><span>제품 등급</span><select value={form.condition_grade} onChange={event=>setForm({...form,condition_grade:event.target.value})}>{GRADES.map(item=><option key={item}>{item}</option>)}</select></label>
            <label><span>보관 위치 유형</span><select value={form.location_type} disabled={activeLocked} onChange={event=>setForm({...form,location_type:event.target.value})}>{LOCATIONS.map(item=><option key={item}>{item}</option>)}</select></label>
            <label><span>상세 위치</span><input value={form.location_text} onChange={event=>setForm({...form,location_text:event.target.value})} placeholder="예: 고양 물류창고 A-03"/></label>
            <label><span>취득일</span><input type="date" value={form.acquired_at} onChange={event=>setForm({...form,acquired_at:event.target.value})}/></label>
            <label><span>취득원가</span><input type="number" min="0" step="1000" value={form.acquisition_cost} onChange={event=>setForm({...form,acquisition_cost:Number(event.target.value)})}/></label>
            <label className="wide"><span>관리 메모</span><textarea value={form.memo} onChange={event=>setForm({...form,memo:event.target.value})} placeholder="점검 이력, 외관 상태, 보관 특이사항을 기록하세요."/></label>
          </div>
          {selected&&<section className="rental-asset-current"><div><span>현재 고객</span><b>{selected.customer?.customer_name||selected.customer?.name||'배정 없음'}</b></div><div><span>현재 위치</span><b>{selected.location_type} · {selected.location_text||'-'}</b></div><div><span>최근 변경</span><b>{dateTime(selected.updated_at)}</b></div></section>}
          {selected&&events.length>0&&<details className="rental-asset-history">
            <summary>자산 변경이력 {events.length}건</summary>
            <div>{events.slice(0,20).map(event=><article key={event.id}>
              <div><b>{event.from_status?`${event.from_status} → ${event.to_status||'-'}`:event.to_status||'자산 등록'}</b><span>{event.event_type}</span></div>
              <time>{dateTime(event.created_at)}</time>
            </article>)}</div>
          </details>}
          <footer><button className="secondary" onClick={()=>createNew()}>입력 초기화</button><button disabled={saving||loading} onClick={()=>void save()}>{saving?'저장 중…':selected?'변경사항 저장':'자산 등록'}</button></footer>
        </div>
      </section>
    </section>
  </main>;
}
