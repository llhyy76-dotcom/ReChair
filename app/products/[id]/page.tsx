import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabaseServer';

type Props = { params: Promise<{ id: string }> };
const money = (v:number) => `${Number(v || 0).toLocaleString('ko-KR')}원`;

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { data: product, error } = await supabase.from('products').select('*').eq('id',id).eq('is_visible',true).single();
  if(error || !product) notFound();
  const photos:string[] = Array.isArray(product.photo_urls) ? product.photo_urls : (product.thumbnail_url ? [product.thumbnail_url] : []);

  return <main className="rc-product-page"><section className="rc-product-card">
    <a className="rc-product-back" href="/products">← 상품 목록으로</a>
    <div className="rc-product-grid">
      <div><div className="rc-product-main-image">{photos[0] ? <img src={photos[0]} alt={product.title}/> : <span>💺</span>}</div>
      {photos.length>1 && <div className="rc-product-thumbnails">{photos.map((u,i)=><img src={u} alt={`${product.title} ${i+1}`} key={`${u}-${i}`}/>)}</div>}</div>
      <div className="rc-product-info"><p>{product.brand}</p><h1>{product.title}</h1><span>{product.model_name}</span>
      <div className="rc-product-price">{money(product.price)}</div>
      <div className="rc-product-specs">
        <div><small>등급</small><strong>{product.grade}</strong></div><div><small>상태</small><strong>{product.status}</strong></div>
        <div><small>연식</small><strong>{product.year_text || '-'}</strong></div><div><small>지역</small><strong>{product.region || '-'}</strong></div>
        <div><small>재고</small><strong>{product.stock_qty ?? 1}대</strong></div><div><small>AS 안내</small><strong>{product.warranty_text || '상담 시 안내'}</strong></div>
      </div>
      {product.description && <div className="rc-product-description">{product.description}</div>}
      <div className="rc-product-buttons"><a href={`/consult?service=buy&product=${product.id}`}>구매 상담 신청</a><a href="/products">다른 상품 보기</a></div>
      </div>
    </div>
  </section></main>;
}
