import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabaseServer';
type Props={params:Promise<{id:string}>};
const money=(v:number)=>`${Number(v||0).toLocaleString('ko-KR')}원`;
export default async function ProductDetailPage({params}:Props){
 const {id}=await params; const supabase=getSupabaseServer();
 const {data:p,error}=await supabase.from('products').select('*').eq('id',id).eq('is_visible',true).single();
 if(error||!p) notFound(); const photos:string[]=Array.isArray(p.photo_urls)?p.photo_urls:(p.thumbnail_url?[p.thumbnail_url]:[]);
 return <main className="rc-product-detail-page"><section className="rc-product-detail-card"><a className="rc-back-link" href="/products">← 상품 목록으로</a><div className="rc-product-detail-grid">
  <div className="rc-product-gallery"><div className="rc-product-main-image">{photos[0]?<img src={photos[0]} alt={p.title}/>:<span>💺</span>}</div>{photos.length>1&&<div className="rc-product-thumbs">{photos.map((u,i)=><img src={u} alt={`${p.title} ${i+1}`} key={u}/>)}</div>}</div>
  <div className="rc-product-info"><p className="rc-product-brand">{p.brand}</p><h1>{p.title}</h1><p className="rc-product-model">{p.model_name}</p><div className="rc-product-price">{money(p.price)}</div>
  <div className="rc-product-spec-grid"><div><small>등급</small><strong>{p.grade}</strong></div><div><small>상태</small><strong>{p.status}</strong></div><div><small>연식</small><strong>{p.year_text||'-'}</strong></div><div><small>지역</small><strong>{p.region||'-'}</strong></div><div><small>재고</small><strong>{p.stock_qty??1}대</strong></div><div><small>AS 안내</small><strong>{p.warranty_text||'상담 시 안내'}</strong></div></div>
  {p.description&&<div className="rc-product-description">{p.description}</div>}<div className="rc-product-actions"><a href={`/consult?service=buy&product=${p.id}`}>구매 상담 신청</a><a href="/products">다른 상품 보기</a></div></div>
 </div></section></main>}
