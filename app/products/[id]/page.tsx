type Props={params:Promise<{id:string}>};
const data:any={1:['코지마 CMC-A100','890,000원','A급 · 경기 고양'],2:['바디프랜드 팬텀','1,280,000원','B+급 · 서울'],3:['세라젬 V7','상담문의','A+급 · 전국']};
export default async function ProductDetail({params}:Props){const {id}=await params;const p=data[id]||data[1];return <main className="section"><div className="product" style={{maxWidth:900,margin:'0 auto'}}><div className="product-img">🪑</div><b>{p[2]}</b><h1>{p[0]}</h1><p>제품 상태 확인 후 이전설치, 배송, AS 가능 여부를 상담해드립니다.</p><div className="price">{p[1]}</div><br/><a href="/#consult" className="btn primary">상담 신청</a></div></main>}
