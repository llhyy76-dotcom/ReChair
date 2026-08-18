import crypto from 'node:crypto';

export const RENTAL_CONTRACT_TERMS_VERSION='2026-08-v1';
export const RENTAL_CONTRACT_COOKIE='rechair_rental_contract_session';
export const RENTAL_CONTRACT_SIGNATURE_BUCKET='rental-contract-signatures';

export type RentalContractType='personal'|'commercial';
export type RentalContractStatus='draft'|'sent'|'signed'|'superseded'|'void';

export type RentalContractSnapshot={
  schema_version:'2026-08-v1';
  contract_no:string;
  contract_type:RentalContractType;
  provider:{
    business_name:string;
    representative:string;
    business_number:string;
    address:string;
    phone:string;
  };
  customer:{
    name:string;
    phone:string;
    installation_address:string;
  };
  product:{
    title:string;
    brand:string;
    model_name:string;
    serial_number:string;
  };
  pricing:{
    monthly_fee:number;
    deposit_amount:number;
    setup_fee:number;
    payment_day:number;
    payment_method:string;
  };
  period:{
    contract_months:number;
    start_date:string;
    end_date:string;
  };
  terms:{
    ownership:string;
    installation_relocation:string;
    maintenance_repair:string;
    loss_damage:string;
    early_termination:string;
    withdrawal:string;
    privacy:string;
    commercial_operation:string;
    special_terms:string;
  };
};

const DEFAULT_TERMS={
  ownership:'계약기간 동안 제품의 소유권은 공급자에게 있으며, 소유권 이전 여부와 조건은 특약사항에 별도로 명시합니다.',
  installation_relocation:'제품은 계약서에 기재된 장소에 설치합니다. 고객이 설치장소를 변경하거나 제품을 이전하려는 경우 사전에 공급자와 협의하며, 추가 비용이 발생하는 경우 작업 전에 안내합니다.',
  maintenance_repair:'정상적인 사용 중 발생한 제품 고장은 공급자가 점검합니다. 고객의 고의·과실, 임의 분해, 사용설명서와 다른 사용으로 발생한 손상과 소모품 비용은 별도 협의합니다.',
  loss_damage:'고객은 제품을 선량하게 관리해야 합니다. 분실·도난·화재·침수 또는 중대한 파손이 발생한 경우 즉시 공급자에게 알리고, 귀책사유와 실제 손해를 확인하여 처리합니다.',
  early_termination:'고객이 중도해지를 요청하면 해지일까지 발생한 렌탈료와 사전에 고지된 실제 회수비를 정산합니다. 별도의 위약금이나 손해배상은 관계 법령과 계약서의 명확한 특약 범위에서만 적용합니다.',
  withdrawal:'고객의 청약철회·계약해지 권리는 관계 법령에서 정한 기준에 따르며, 이 계약의 내용이 법률상 권리를 부당하게 제한하지 않습니다.',
  privacy:'필수 수집항목은 성명, 연락처, 설치주소, 계약·납부·서비스 이력입니다. 계약 체결과 이행, 요금 정산, 제품 설치·회수, 고객지원 및 법적 의무 준수를 위해 처리하며 계약 종료 후 5년간 보관합니다. 관련 법령에서 별도 기간을 정한 경우에는 그 기간을 따릅니다. 고객은 동의를 거부할 수 있으나 필수정보 처리에 동의하지 않으면 렌탈 계약 체결과 서비스 제공이 어렵습니다.',
  commercial_operation:'',
  special_terms:'별도 특약 없음',
};

const COMMERCIAL_OPERATION='코인형 제품의 운영수익은 별도 특약이 없는 한 고객에게 귀속됩니다. 고객은 영업장 사용권한, 전원과 설치공간, 이용자 안전과 일상 관리를 담당하며, 수익배분·정산·영업시간·도난 및 제3자 훼손 책임이 있는 경우 특약사항에 구체적으로 기재합니다.';

export function normalizePhone(value:unknown){
  return String(value||'').replace(/\D/g,'');
}

export function maskPhone(value:unknown){
  const digits=normalizePhone(value);
  if(digits.length<7)return '등록된 연락처';
  return `${digits.slice(0,3)}-****-${digits.slice(-4)}`;
}

export function rentalTypeFromService(value:unknown):RentalContractType{
  return String(value||'').includes('영업용')?'commercial':'personal';
}

export function createRentalContractAccessToken(){
  return crypto.randomBytes(32).toString('base64url');
}

export function hashRentalContractAccessToken(token:string){
  return crypto.createHash('sha256').update(token).digest('hex');
}

function contractSecret(){
  const value=process.env.ADMIN_SESSION_SECRET;
  if(!value)throw new Error('ADMIN_SESSION_SECRET 환경변수가 설정되지 않았습니다.');
  return value;
}

function signSessionPayload(payload:string){
  return crypto
    .createHmac('sha256',contractSecret())
    .update(`rental-contract:${payload}`)
    .digest('base64url');
}

export function createRentalContractSession(contractId:string,accessTokenHash:string){
  const payload=Buffer.from(JSON.stringify({
    contract_id:contractId,
    access_token_hash:accessTokenHash,
    exp:Date.now()+30*60*1000,
  })).toString('base64url');
  return `${payload}.${signSessionPayload(payload)}`;
}

export function verifyRentalContractSession(
  token:unknown,
  contractId:string,
  accessTokenHash:string
){
  try{
    const [payload,signature]=String(token||'').split('.');
    if(!payload||!signature)return false;
    const expected=signSessionPayload(payload);
    const actualBuffer=Buffer.from(signature);
    const expectedBuffer=Buffer.from(expected);
    if(
      actualBuffer.length!==expectedBuffer.length||
      !crypto.timingSafeEqual(actualBuffer,expectedBuffer)
    )return false;
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return parsed?.contract_id===contractId&&
      parsed?.access_token_hash===accessTokenHash&&
      Number(parsed?.exp)>Date.now();
  }catch{
    return false;
  }
}

export const rentalContractCookieOptions={
  httpOnly:true,
  sameSite:'strict' as const,
  secure:process.env.NODE_ENV==='production',
  path:'/',
  maxAge:30*60,
};

function cleanText(value:unknown,max=2000){
  return String(value||'').trim().slice(0,max);
}

function nonNegative(value:unknown){
  const number=Number(value||0);
  return Number.isFinite(number)?Math.max(0,number):0;
}

function dateOnly(value:unknown){
  const text=cleanText(value,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:'';
}

export function sanitizeRentalContractSnapshot(
  raw:any,
  contractNo:string,
  contractType:RentalContractType
):RentalContractSnapshot{
  return {
    schema_version:'2026-08-v1',
    contract_no:cleanText(contractNo,80),
    contract_type:contractType,
    provider:{
      business_name:cleanText(raw?.provider?.business_name,120),
      representative:cleanText(raw?.provider?.representative,80),
      business_number:cleanText(raw?.provider?.business_number,30),
      address:cleanText(raw?.provider?.address,300),
      phone:cleanText(raw?.provider?.phone,30),
    },
    customer:{
      name:cleanText(raw?.customer?.name,80),
      phone:cleanText(raw?.customer?.phone,30),
      installation_address:cleanText(raw?.customer?.installation_address,300),
    },
    product:{
      title:cleanText(raw?.product?.title,200),
      brand:cleanText(raw?.product?.brand,100),
      model_name:cleanText(raw?.product?.model_name,120),
      serial_number:cleanText(raw?.product?.serial_number,120),
    },
    pricing:{
      monthly_fee:nonNegative(raw?.pricing?.monthly_fee),
      deposit_amount:nonNegative(raw?.pricing?.deposit_amount),
      setup_fee:nonNegative(raw?.pricing?.setup_fee),
      payment_day:Math.max(0,Math.min(31,Math.trunc(Number(raw?.pricing?.payment_day||0)))),
      payment_method:cleanText(raw?.pricing?.payment_method,100),
    },
    period:{
      contract_months:Math.max(0,Math.min(120,Math.trunc(Number(raw?.period?.contract_months||0)))),
      start_date:dateOnly(raw?.period?.start_date),
      end_date:dateOnly(raw?.period?.end_date),
    },
    terms:{
      ownership:cleanText(raw?.terms?.ownership,4000),
      installation_relocation:cleanText(raw?.terms?.installation_relocation,4000),
      maintenance_repair:cleanText(raw?.terms?.maintenance_repair,4000),
      loss_damage:cleanText(raw?.terms?.loss_damage,4000),
      early_termination:cleanText(raw?.terms?.early_termination,4000),
      withdrawal:cleanText(raw?.terms?.withdrawal,4000),
      privacy:cleanText(raw?.terms?.privacy,4000),
      commercial_operation:contractType==='commercial'
        ?cleanText(raw?.terms?.commercial_operation,4000)
        :'',
      special_terms:cleanText(raw?.terms?.special_terms,4000),
    },
  };
}

export function buildRentalContractDraft({
  consultation,
  contractNo,
  contractType,
  providerDefaults,
}:{
  consultation:any;
  contractNo:string;
  contractType:RentalContractType;
  providerDefaults?:Partial<RentalContractSnapshot['provider']>|null;
}):RentalContractSnapshot{
  return sanitizeRentalContractSnapshot({
    provider:providerDefaults||{},
    customer:{
      name:consultation.customer_name??consultation.name??'',
      phone:consultation.phone??'',
      installation_address:consultation.address??'',
    },
    product:{
      title:consultation.product_title??consultation.service_type??'',
      brand:consultation.brand??'',
      model_name:consultation.model_name??consultation.model??'',
      serial_number:'',
    },
    pricing:{
      monthly_fee:consultation.rental_monthly_fee??0,
      deposit_amount:consultation.rental_deposit_amount??0,
      setup_fee:consultation.rental_setup_fee??0,
      payment_day:consultation.rental_payment_day??0,
      payment_method:'계좌이체',
    },
    period:{
      contract_months:consultation.rental_contract_months??0,
      start_date:consultation.rental_start_date??'',
      end_date:consultation.rental_end_date??'',
    },
    terms:{
      ...DEFAULT_TERMS,
      commercial_operation:contractType==='commercial'?COMMERCIAL_OPERATION:'',
      special_terms:cleanText(consultation.rental_terms_memo,4000)||DEFAULT_TERMS.special_terms,
    },
  },contractNo,contractType);
}

export function rentalContractDocumentHash(snapshot:RentalContractSnapshot){
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function validateRentalContractForSending(snapshot:RentalContractSnapshot){
  const missing:string[]=[];
  const required:[string,unknown][]=[
    ['공급자 상호',snapshot.provider.business_name],
    ['대표자',snapshot.provider.representative],
    ['사업자등록번호',snapshot.provider.business_number],
    ['공급자 주소',snapshot.provider.address],
    ['공급자 연락처',snapshot.provider.phone],
    ['고객 이름',snapshot.customer.name],
    ['고객 연락처',snapshot.customer.phone],
    ['설치 주소',snapshot.customer.installation_address],
    ['상품명',snapshot.product.title],
    ['결제방법',snapshot.pricing.payment_method],
    ['계약 시작일',snapshot.period.start_date],
    ['계약 종료일',snapshot.period.end_date],
  ];
  for(const [label,value] of required){if(!String(value||'').trim())missing.push(label)}
  if(normalizePhone(snapshot.customer.phone).length<9)missing.push('정확한 고객 연락처');
  if(normalizePhone(snapshot.provider.phone).length<9)missing.push('정확한 공급자 연락처');
  if(String(snapshot.provider.business_number||'').replace(/\D/g,'').length!==10){
    missing.push('10자리 사업자등록번호');
  }
  if(snapshot.period.contract_months<1)missing.push('계약기간');
  if(snapshot.pricing.payment_day<1)missing.push('매월 결제일');
  if(
    snapshot.period.start_date&&snapshot.period.end_date&&
    snapshot.period.end_date<snapshot.period.start_date
  )missing.push('계약 시작일·종료일 순서');
  for(const [key,value] of Object.entries(snapshot.terms)){
    if(key!=='commercial_operation'&&!String(value||'').trim())missing.push('계약 조항');
  }
  if(snapshot.contract_type==='commercial'&&!snapshot.terms.commercial_operation){
    missing.push('영업용 운영·정산 조건');
  }
  return Array.from(new Set(missing));
}

export function createRentalContractNumber(consultationId:string,version:number){
  const date=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date()).replaceAll('-','');
  return `RC-${date}-${consultationId.replace(/-/g,'').slice(0,6).toUpperCase()}-V${version}`;
}
