import Footer from '@/components/Footer';
import { formatPrice, products } from '@/components/productData';

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = products.find((item) => item.id === id) || products[0];

  return (
    <main>
      <section className="rc-product-detail">
        <div className="rc-product-detail-card">
          <a className="service-back-link" href="/products">← 상품 목록으로</a>

          <div className="rc-product-detail-grid">
            <div className="rc-product-detail-image">
              <span>{product.image}</span>
              <b>{product.grade}</b>
            </div>

            <div className="rc-product-detail-info">
              <p className="eyebrow">{product.brand}</p>
              <h1>{product.name}</h1>
              <p>{product.summary}</p>

              <div className="rc-product-detail-price">{formatPrice(product.price)}</div>

              <div className="rc-product-detail-specs">
                <div><strong>상태</strong><span>{product.status}</span></div>
                <div><strong>연식</strong><span>{product.year}</span></div>
                <div><strong>지역</strong><span>{product.region}</span></div>
              </div>

              <ul className="rc-product-feature-list">
                {product.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              <div className="service-detail-actions">
                <a className="primary-button" href="/#consult">상품 문의하기</a>
                <a className="secondary-button" href="/products">다른 상품 보기</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
