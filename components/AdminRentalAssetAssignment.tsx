'use client';

import {useCallback,useEffect,useState} from 'react';

export default function AdminRentalAssetAssignment({
  consultationId,
  onRefresh,
}:{
  consultationId:string;
  onRefresh?:()=>void|Promise<void>;
}){
  const [data,setData]=useState<any>(null);
  const [assetId,setAssetId]=useState('');
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'error'|'working'>('success');

  async function responseBody(response:Response){
    const text=await response.text();
    if(!text)return {};
    try{return JSON.parse(text)}catch{return {error:`서버 응답 오류 (HTTP ${response.status})`}}
  }

  const load=useCallback(async()=>{
    try{
      setLoading(true);
      const response=await fetch(`/api/admin/consultations/${consultationId}/rental-asset`,{cache:'no-store'});
      const body=await responseBody(response);
      if(!response.ok){setTone('error');setMessage(body.error||'자산 배정정보 조회 오류');return;}
      setData(body.data);
      if(!body.data?.assigned&&body.data?.available?.length===1){
        setAssetId(body.data.available[0].id);
      }
    }catch(error){
      console.error('rental asset assignment load error',error);
      setTone('error');setMessage('자산 배정정보를 불러오지 못했습니다.');
    }finally{setLoading(false)}
  },[consultationId]);

  useEffect(()=>{void load()},[load]);

  async function update(action:'assign'|'release'){
    if(action==='assign'&&!assetId){setTone('error');setMessage('배정할 실물 자산을 선택해 주세요.');return;}
    try{
      setLoading(true);setTone('working');setMessage(action==='assign'?'실물 자산을 계약에 배정하고 있습니다.':'자산 배정을 해제하고 있습니다.');
      const response=await fetch(`/api/admin/consultations/${consultationId}/rental-asset`,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,asset_id:assetId}),
      });
      const body=await responseBody(response);
      if(!response.ok){setTone('error');setMessage(body.error||'렌탈 자산 배정 오류');return;}
      setData(body.data);setAssetId('');setTone('success');
      setMessage(action==='assign'?'계약에 실물 자산이 배정되었습니다.':'실물 자산 배정이 해제되었습니다.');
      await onRefresh?.();
    }catch(error){
      console.error('rental asset assignment update error',error);
      setTone('error');setMessage('렌탈 자산 배정을 저장하지 못했습니다.');
    }finally{setLoading(false)}
  }

  if(!data)return <section className="rental-asset-assignment"><p>{loading?'개별 자산정보를 확인하고 있습니다.':message||'개별 자산정보가 없습니다.'}</p></section>;

  const {consultation,product,assigned,available=[]}=data;
  const signed=Boolean(consultation.rental_contract_id&&consultation.rental_contract_signed_at);
  const stageReady=['계약완료','설치예약','운영중'].includes(String(consultation.rental_stage||''));
  const legacyOperating=consultation.rental_stage==='운영중'&&!product?.rental_asset_managed;
  const canRelease=assigned?.status==='배정완료';

  return <section className="rental-asset-assignment">
    <header>
      <div><span>PHYSICAL ASSET ASSIGNMENT</span><h4>개별 안마의자 배정</h4><p>전자서명 후 설치할 실제 안마의자 한 대를 계약에 연결합니다.</p></div>
      <b data-state={assigned?.status||'미배정'}>{assigned?.status||'미배정'}</b>
    </header>

    {!product&&<div className="rental-asset-assignment-note error">상담에 렌탈 상품이 연결되어 있지 않습니다. 먼저 상품을 선택해 저장해 주세요.</div>}
    {product&&!product.rental_asset_managed&&<div className="rental-asset-assignment-note legacy"><div><b>이 상품은 아직 기존 수량 방식입니다.</b><span>기존 운영 계약이라면 아래에서 설치된 실물을 먼저 연결하고, 전체 계약 연결 후 자산대장에서 관리를 적용하세요.</span></div><a href="/admin/rental/assets">개별 자산대장 열기</a></div>}

    {product&&(product.rental_asset_managed||assigned||available.length>0)&&<>
      {assigned?<div className="rental-assigned-asset">
        <div><span>자산번호</span><b>{assigned.asset_no}</b></div>
        <div><span>제조번호</span><b>{assigned.serial_number||'미입력'}</b></div>
        <div><span>제품</span><b>{assigned.brand||'-'} · {assigned.model_name||'-'}</b></div>
        <div><span>보관·설치 위치</span><b>{assigned.location_type} · {assigned.location_text||'-'}</b></div>
      </div>:<div className="rental-asset-select">
        <label><span>렌탈 가능한 실물 자산</span><select value={assetId} onChange={event=>setAssetId(event.target.value)}><option value="">자산을 선택하세요</option>{available.map((asset:any)=><option key={asset.id} value={asset.id}>{asset.asset_no} · {asset.serial_number||'제조번호 미입력'} · {asset.condition_grade}</option>)}</select></label>
        <button disabled={loading||!assetId||(!signed&&!legacyOperating)||!stageReady} onClick={()=>void update('assign')}>{loading?'처리 중…':'선택 자산 배정'}</button>
      </div>}

      {!signed&&!legacyOperating&&<p className="rental-asset-assignment-help">고객 전자서명 완료 후 자산을 배정할 수 있습니다.</p>}
      {legacyOperating&&<p className="rental-asset-assignment-help">기존 운영 계약 전환 모드입니다. 현재 고객에게 실제 설치된 자산을 정확히 선택해 주세요.</p>}
      {signed&&!stageReady&&<p className="rental-asset-assignment-help">렌탈 단계가 계약완료·설치예약·운영중일 때 자산을 배정할 수 있습니다.</p>}
      {!assigned&&signed&&stageReady&&!available.length&&<p className="rental-asset-assignment-help">이 상품에 렌탈 가능한 자산이 없습니다. 자산대장에서 새 자산을 등록하거나 상태를 확인해 주세요.</p>}
      {assigned&&<footer><a href="/admin/rental/assets">자산대장에서 보기</a><button disabled={loading||!canRelease} onClick={()=>void update('release')} title={!canRelease?'설치가 시작된 자산은 배정을 해제할 수 없습니다.':undefined}>배정 해제</button></footer>}
    </>}

    {message&&<p className="rental-asset-assignment-message" data-tone={tone}>{message}</p>}
  </section>;
}
