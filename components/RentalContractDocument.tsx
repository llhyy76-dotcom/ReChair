function money(value:unknown){return `${Number(value||0).toLocaleString('ko-KR')}원`}

function dateTime(value:unknown){
  const date=new Date(String(value||''));
  return Number.isNaN(date.getTime())?'-':date.toLocaleString('ko-KR');
}

export default function RentalContractDocument({snapshot,contract}:{snapshot:any;contract:any}){
  const customer=snapshot.customer||{};
  const provider=snapshot.provider||{};
  const entityType=customer.entity_type||'individual';
  const entityLabel=entityType==='corporation'
    ?'법인사업자'
    :entityType==='sole_proprietor'
      ?'개인사업자'
      :'개인';
  const clauses=[
    ['소유권',snapshot.terms.ownership],
    ['설치 및 이전',snapshot.terms.installation_relocation],
    ['유지보수 및 수리',snapshot.terms.maintenance_repair],
    ['분실 및 파손',snapshot.terms.loss_damage],
    ['중도해지',snapshot.terms.early_termination],
    ['청약철회 및 해지권',snapshot.terms.withdrawal],
    ['개인정보 처리',snapshot.terms.privacy],
    ...(entityType!=='individual'&&snapshot.terms.business_transaction
      ?[['사업자 계약 및 서명권한',snapshot.terms.business_transaction]]
      :[]),
    ...(snapshot.contract_type==='commercial'
      ?[['영업용 운영 및 정산',snapshot.terms.commercial_operation]]
      :[]),
    ['특약사항',snapshot.terms.special_terms],
  ];

  return <div className="rental-contract-document">
    <header>
      <p>RECHAIR RENTAL AGREEMENT</p>
      <h1>안마의자 렌탈 계약서</h1>
      <span>{snapshot.contract_type==='commercial'?'영업용(코인형) 렌탈':'개인용 렌탈'} · 계약자 {entityLabel} · {snapshot.contract_no} · v{contract.version}</span>
    </header>

    <section className="contract-party-grid">
      <div>
        <h2>공급자</h2>
        <p><b>{provider.business_name}</b></p>
        <p>대표 {provider.representative}</p>
        <p>사업자등록번호 {provider.business_number}</p>
        {provider.entity_type==='corporation'&&provider.corporate_number&&<p>법인등록번호 {provider.corporate_number}</p>}
        <p>{provider.address}</p>
        <p>{provider.phone}</p>
      </div>
      <div>
        <h2>계약자 · {entityLabel}</h2>
        {entityType==='individual'?<>
          <p><b>{customer.name}</b></p>
          <p>{customer.phone}</p>
          <p>설치주소 {customer.installation_address}</p>
        </>:<>
          <p><b>{customer.business_name}</b></p>
          <p>대표 {customer.representative}</p>
          <p>사업자등록번호 {customer.business_number}</p>
          {entityType==='corporation'&&customer.corporate_number&&<p>법인등록번호 {customer.corporate_number}</p>}
          <p>{customer.business_address}</p>
          <p>담당 {customer.name||'-'} · {customer.phone}</p>
          <p>설치주소 {customer.installation_address}</p>
          <p>서명자 {customer.signer_name}{customer.signer_title?` · ${customer.signer_title}`:''}</p>
        </>}
      </div>
    </section>

    <section>
      <h2>제품 및 계약조건</h2>
      <table><tbody>
        <tr><th>상품</th><td>{snapshot.product.title}</td><th>모델</th><td>{[snapshot.product.brand,snapshot.product.model_name].filter(Boolean).join(' · ')||'-'}</td></tr>
        <tr><th>제조번호</th><td>{snapshot.product.serial_number||'설치 시 확인'}</td><th>계약기간</th><td>{snapshot.period.start_date} ~ {snapshot.period.end_date} ({snapshot.period.contract_months}개월)</td></tr>
        <tr><th>월 렌탈료</th><td>{money(snapshot.pricing.monthly_fee)}</td><th>보증금·설치비</th><td>{money(snapshot.pricing.deposit_amount)} · {money(snapshot.pricing.setup_fee)}</td></tr>
        <tr><th>납부조건</th><td colSpan={3}>매월 {snapshot.pricing.payment_day}일 · {snapshot.pricing.payment_method}</td></tr>
      </tbody></table>
    </section>

    <section>
      <h2>계약 조항</h2>
      {clauses.map(([title,text],index)=><div className="contract-clause" key={title}>
        <b>제{index+1}조 {title}</b><p>{text}</p>
      </div>)}
    </section>

    {contract.signed_at?<section className="contract-sign-block">
        <p>고객은 위 계약내용과 개인정보 처리 안내를 확인하고 동의했습니다.</p>
        <div><span>서명일시</span><b>{dateTime(contract.signed_at)}</b></div>
        <div><span>서명자</span><b>{contract.signer_name||customer.signer_name||customer.name}</b></div>
        {contract.signature_url&&<img src={contract.signature_url} alt="전자서명"/>}
        <small>문서 검증값: {contract.document_sha256}</small>
      </section>
      :<section className="contract-sign-block pending">
        <p>아직 고객 전자서명이 완료되지 않은 계약서입니다.</p>
        <small>문서 검증값: {contract.document_sha256}</small>
      </section>}
  </div>;
}
