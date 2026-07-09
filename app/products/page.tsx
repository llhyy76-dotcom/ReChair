import Footer from '@/components/Footer';
import ProductList from '@/components/ProductList';

export default function ProductsPage() {
  return (
    <main>
      <section className="rc-sub-hero">
        <div className="container">
          <p className="eyebrow">ReChair Products</p>
          <h1>중고·리퍼 판매상품</h1>
          <p>상담 가능한 상품을 확인하고 상세 정보를 살펴보세요.</p>
        </div>
      </section>
      <ProductList />
      <Footer />
    </main>
  );
}
