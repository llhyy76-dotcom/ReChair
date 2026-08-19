import crypto from 'node:crypto';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const RENTAL_ASSET_STATUSES=[
  '렌탈가능','배정완료','설치예약','렌탈중','회수예정',
  '점검중','정비중','폐기검토','폐기완료',
] as const;

export const RENTAL_ASSET_MANUAL_STATUSES=[
  '렌탈가능','점검중','정비중','폐기검토','폐기완료',
] as const;

export const RENTAL_ASSET_LOCATIONS=[
  '창고','고객설치','기사보관','정비처','폐기','기타',
] as const;

export type RentalAssetStatus=typeof RENTAL_ASSET_STATUSES[number];
export type RentalAssetManualStatus=typeof RENTAL_ASSET_MANUAL_STATUSES[number];

function cleanText(value:unknown,max=1000){
  return String(value||'').trim().slice(0,max);
}

export function createRentalAssetNumber(){
  const date=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date()).replaceAll('-','');
  return `RA-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function sanitizeRentalAssetInput(raw:any){
  const status=RENTAL_ASSET_MANUAL_STATUSES.includes(raw?.status)
    ?raw.status as RentalAssetManualStatus
    :'렌탈가능';
  const locationType=RENTAL_ASSET_LOCATIONS.includes(raw?.location_type)
    ?String(raw.location_type)
    :'창고';
  const cost=Number(raw?.acquisition_cost||0);
  return {
    asset_no:cleanText(raw?.asset_no,80),
    product_id:cleanText(raw?.product_id,80)||null,
    serial_number:cleanText(raw?.serial_number,120)||null,
    status,
    condition_grade:cleanText(raw?.condition_grade,30)||'A급',
    location_type:locationType,
    location_text:cleanText(raw?.location_text,300)||null,
    acquired_at:/^\d{4}-\d{2}-\d{2}$/.test(cleanText(raw?.acquired_at,10))
      ?cleanText(raw?.acquired_at,10)
      :null,
    acquisition_cost:Number.isFinite(cost)?Math.max(0,cost):0,
    memo:cleanText(raw?.memo,4000)||null,
  };
}

export function returnDispositionStatus(value:unknown):RentalAssetStatus{
  const map:Record<string,RentalAssetStatus>={
    재렌탈가능:'렌탈가능',
    점검필요:'점검중',
    정비필요:'정비중',
    폐기검토:'폐기검토',
  };
  return map[String(value)]||'점검중';
}

export function statusLocation(status:RentalAssetStatus){
  if(status==='렌탈중')return '고객설치';
  if(status==='정비중'||status==='점검중')return '정비처';
  if(status==='폐기검토'||status==='폐기완료')return '폐기';
  return '창고';
}

export async function recordRentalAssetEvent({
  supabase,
  assetId,
  consultationId=null,
  scheduleId=null,
  eventType,
  fromStatus=null,
  toStatus=null,
  actorType='system',
  detail={},
}:{
  supabase:ReturnType<typeof getSupabaseServer>;
  assetId:string;
  consultationId?:string|null;
  scheduleId?:string|null;
  eventType:string;
  fromStatus?:string|null;
  toStatus?:string|null;
  actorType?:'admin'|'technician'|'system';
  detail?:Record<string,unknown>;
}){
  const {error}=await supabase.from('rental_asset_events').insert({
    asset_id:assetId,
    consultation_id:consultationId,
    schedule_id:scheduleId,
    event_type:eventType,
    from_status:fromStatus,
    to_status:toStatus,
    actor_type:actorType,
    detail,
  });
  if(error)throw error;
}

export async function syncRentalProductFromAssets(
  supabase:ReturnType<typeof getSupabaseServer>,
  productId:unknown
){
  if(!productId)return false;
  const {data:product,error:productError}=await supabase
    .from('products')
    .select('id,rental_asset_managed')
    .eq('id',String(productId))
    .maybeSingle();
  if(productError)throw productError;
  if(!product?.rental_asset_managed)return false;

  const {data:assets,error:assetError}=await supabase
    .from('rental_assets')
    .select('status')
    .eq('product_id',product.id);
  if(assetError)throw assetError;

  const statuses=(assets||[]).map(item=>String(item.status));
  const available=statuses.filter(status=>status==='렌탈가능').length;
  const active=statuses.some(status=>['배정완료','설치예약','렌탈중'].includes(status));
  const retrieving=statuses.some(status=>status==='회수예정');
  const stockQty=statuses.filter(status=>status!=='폐기완료').length;
  const nextStatus=available>0
    ?'렌탈가능'
    :retrieving
      ?'회수예정'
      :active
        ?'렌탈중'
        :statuses.includes('정비중')
          ?'정비중'
          :statuses.includes('점검중')
            ?'점검중'
            :statuses.includes('폐기검토')
              ?'폐기검토'
              :'폐기완료';

  const {error:updateError}=await supabase.from('products').update({
    status:nextStatus,
    stock_qty:stockQty,
    is_visible:available>0,
    updated_at:new Date().toISOString(),
  }).eq('id',product.id);
  if(updateError)throw updateError;
  return true;
}
