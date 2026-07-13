import ProductCatalog from '@/components/ProductCatalog';

export default function ProductsPage() {
  return <main>
    <section className="rc-store-hero"><div><p>RECHAIR PRODUCTS</p><h1>중고·리퍼 판매상품</h1><span>검수된 상품을 확인하고 구매 상담을 신청하세요.</span></div></section>
    <ProductCatalog />
  </main>;
}
