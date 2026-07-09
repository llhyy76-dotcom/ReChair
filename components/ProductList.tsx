import { formatPrice, products } from '@/components/productData';

export default function ProductList() {
  return (
    <section className="product-section rc-products" id="products">
      <div className="container rc-products-container">
        <p className="eyebrow">ReChair Products</p>
        <h2>판매 가능 상품</h2>
        <p className="rc-products-lead">
          현재 상담 가능한 중고·리퍼 안마의자입니다. 상품 상태와 가격은 상담 시점에 따라 변동될 수 있습니다.
        </p>

        <div className="rc-product-grid">
          {products.map((product) => (
            <a className="rc-product-card" href={`/products/${product.id}`} key={product.id}>
              <div className="rc-product-image">
                <span>{product.image}</span>
                <b>{product.grade}</b>
              </div>
              <div className="rc-product-body">
                <small>{product.brand} · {product.status}</small>
                <h3>{product.name}</h3>
                <p>{product.summary}</p>
                <div className="rc-product-meta">
                  <span>{product.year}</span>
                  <span>{product.region}</span>
                </div>
                <strong>{formatPrice(product.price)}</strong>
                <em>상세보기 ›</em>
              </div>
            </a>
          ))}
        </div>

        <div className="rc-products-more">
          <a href="/products">전체 상품 보기</a>
        </div>
      </div>
    </section>
  );
}
