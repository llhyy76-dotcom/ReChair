import Header from '@/components/Header';

export default function Admin(){
  return <><Header/><main className="wrap admin"><h1>ReChair 관리자 대시보드</h1><p>Supabase 연결 후 상담 접수, 예약, 상품을 관리하는 화면으로 확장됩니다.</p><div className="grid"><div className="card"><b>신규 상담</b><h2>0</h2></div><div className="card"><b>오늘 예약</b><h2>0</h2></div><div className="card"><b>등록 상품</b><h2>0</h2></div></div><h2 style={{marginTop:40}}>상담 접수 목록</h2><table className="table"><thead><tr><th>접수일</th><th>고객</th><th>서비스</th><th>지역</th><th>상태</th></tr></thead><tbody><tr><td>DB 연결 후 표시</td><td>-</td><td>-</td><td>-</td><td>-</td></tr></tbody></table></main></>
}
