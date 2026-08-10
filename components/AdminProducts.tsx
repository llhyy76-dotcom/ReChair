'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type Product = {
  id: string;
  title: string;
  brand: string;
  model_name: string;
  price: number;
  grade: string;
  status: string;
  year_text?: string | null;
  region?: string | null;
  warranty_text?: string | null;
  description?: string | null;
  stock_qty: number;
  is_visible: boolean;
  is_featured: boolean;
  thumbnail_url?: string | null;
  photo_urls?: string[] | null;
  listing_type?: 'sale' | 'rental';
  rental_type?: 'personal' | 'commercial' | null;
  monthly_fee?: number | null;
  deposit_amount?: number | null;
  setup_fee?: number | null;
  contract_months?: number | null;
  installation_regions?: string | null;
  rental_notes?: string | null;
};

type ProductForm = {
  listing_type: 'sale' | 'rental';
  rental_type: 'personal' | 'commercial';
  title: string;
  brand: string;
  model_name: string;
  price: string;
  grade: string;
  status: string;
  year_text: string;
  region: string;
  warranty_text: string;
  description: string;
  stock_qty: string;
  is_visible: boolean;
  is_featured: boolean;
  photo_urls: string[];
  monthly_fee: string;
  deposit_amount: string;
  setup_fee: string;
  contract_months: string;
  installation_regions: string;
  rental_notes: string;
};

const emptyForm: ProductForm = {
  listing_type: 'sale',
  rental_type: 'personal',
  title: '',
  brand: '',
  model_name: '',
  price: '',
  grade: 'A급',
  status: '판매중',
  year_text: '',
  region: '',
  warranty_text: '',
  description: '',
  stock_qty: '1',
  is_visible: true,
  is_featured: false,
  photo_urls: [],
  monthly_fee: '',
  deposit_amount: '',
  setup_fee: '',
  contract_months: '36',
  installation_regions: '',
  rental_notes: '',
};

function toForm(product?: Product): ProductForm {
  if (!product) return emptyForm;

  const photos = Array.isArray(product.photo_urls)
    ? product.photo_urls
    : product.thumbnail_url
      ? [product.thumbnail_url]
      : [];

  return {
    listing_type: product.listing_type === 'rental' ? 'rental' : 'sale',
    rental_type: product.rental_type === 'commercial' ? 'commercial' : 'personal',
    title: product.title || '',
    brand: product.brand || '',
    model_name: product.model_name || '',
    price: String(product.price || ''),
    grade: product.grade || 'A급',
    status: product.status || '판매중',
    year_text: product.year_text || '',
    region: product.region || '',
    warranty_text: product.warranty_text || '',
    description: product.description || '',
    stock_qty: String(product.stock_qty || 1),
    is_visible: product.is_visible !== false,
    is_featured: product.is_featured === true,
    photo_urls: photos,
    monthly_fee: String(product.monthly_fee || ''),
    deposit_amount: String(product.deposit_amount || ''),
    setup_fee: String(product.setup_fee || ''),
    contract_months: String(product.contract_months || 36),
    installation_regions: product.installation_regions || '',
    rental_notes: product.rental_notes || '',
  };
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => products.find((product) => product.id === selectedId),
    [products, selectedId]
  );

  async function loadProducts(preferredId?: string) {
    const response = await fetch('/api/products', { cache: 'no-store' });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result?.error || '상품 목록을 불러오지 못했습니다.');
      return;
    }

    const nextProducts: Product[] = result.data || [];
    setProducts(nextProducts);

    const nextId =
      preferredId ||
      selectedId ||
      nextProducts[0]?.id ||
      '';

    setSelectedId(nextId);
    setForm(toForm(nextProducts.find((item) => item.id === nextId)));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm(toForm(selected));
    clearNewFiles();
  }, [selectedId]);

  function clearNewFiles() {
    newPreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewFiles([]);
    setNewPreviews([]);
  }

  function startNewProduct() {
    setSelectedId('');
    setForm(emptyForm);
    clearNewFiles();
    setMessage('');
  }

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 8);
    newPreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewFiles(files);
    setNewPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  async function uploadNewPhotos(): Promise<string[]> {
    if (newFiles.length === 0) return [];

    const data = new FormData();
    newFiles.forEach((file) => data.append('files', file));

    const response = await fetch('/api/products/upload', {
      method: 'POST',
      body: data,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || '사진 업로드에 실패했습니다.');
    }

    return result.urls || [];
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.photo_urls.length) return;

    const next = [...form.photo_urls];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setForm({ ...form, photo_urls: next });
  }

  function removePhoto(index: number) {
    setForm({
      ...form,
      photo_urls: form.photo_urls.filter((_, photoIndex) => photoIndex !== index),
    });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(selectedId ? '상품을 수정하는 중입니다...' : '상품을 등록하는 중입니다...');

    try {
      const uploaded = await uploadNewPhotos();
      const photos = [...form.photo_urls, ...uploaded];

      const payload = {
        listing_type: form.listing_type,
        rental_type: form.listing_type === 'rental' ? form.rental_type : null,
        title: form.title.trim(),
        brand: form.brand.trim(),
        model_name: form.model_name.trim(),
        price: Number(form.price || 0),
        grade: form.grade,
        status: form.status,
        year_text: form.year_text || null,
        region: form.region || null,
        warranty_text: form.warranty_text || null,
        description: form.description || null,
        stock_qty: Number(form.stock_qty || 1),
        is_visible: form.is_visible,
        is_featured: form.is_featured,
        photo_urls: photos,
        thumbnail_url: photos[0] || null,
        monthly_fee: Number(form.monthly_fee || 0),
        deposit_amount: Number(form.deposit_amount || 0),
        setup_fee: Number(form.setup_fee || 0),
        contract_months: Number(form.contract_months || 0),
        installation_regions: form.installation_regions || null,
        rental_notes: form.rental_notes || null,
      };

      const response = await fetch(
        selectedId ? `/api/products/${selectedId}` : '/api/products',
        {
          method: selectedId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || '상품 저장에 실패했습니다.');
      }

      clearNewFiles();
      await loadProducts(result.data?.id || selectedId);
      setMessage(selectedId ? '상품이 수정되었습니다.' : '상품이 등록되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '상품 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: string) {
    if (!window.confirm('이 상품을 삭제하시겠습니까?')) return;

    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(result?.error || '상품 삭제에 실패했습니다.');
      return;
    }

    setSelectedId('');
    setForm(emptyForm);
    await loadProducts();
    setMessage('상품이 삭제되었습니다.');
  }

  return (
    <div className="rc-admin-product-layout">
      <aside className="rc-admin-product-sidebar">
        <div className="rc-admin-sidebar-head">
          <div>
            <p>PRODUCT MANAGER</p>
            <h2>등록 상품</h2>
          </div>
          <button type="button" onClick={startNewProduct}>＋ 신규</button>
        </div>

        <div className="rc-admin-product-menu">
          {products.length === 0 && (
            <p className="rc-admin-product-empty">등록된 상품이 없습니다.</p>
          )}

          {products.map((product) => (
            <button
              type="button"
              className={product.id === selectedId ? 'active' : ''}
              onClick={() => setSelectedId(product.id)}
              key={product.id}
            >
              <strong>
                <em className={product.listing_type === 'rental' ? 'rental' : 'sale'}>
                  {product.listing_type === 'rental' ? '렌탈' : '판매'}
                </em>
                {product.title}
              </strong>
              <span>{product.brand} · {product.model_name}</span>
              <small>
                {product.listing_type === 'rental'
                  ? `${Number(product.monthly_fee || 0).toLocaleString('ko-KR')}원/월`
                  : `${Number(product.price || 0).toLocaleString('ko-KR')}원`} · {product.status}
              </small>
            </button>
          ))}
        </div>
      </aside>

      <section className="rc-admin-product-editor">
        <div className="rc-admin-editor-head">
          <div>
            <p>{selectedId ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</p>
            <h1>{selectedId ? '상품 수정' : '상품 등록'}</h1>
          </div>

          {selectedId && (
            <button
              type="button"
              className="danger"
              onClick={() => removeProduct(selectedId)}
            >
              상품 삭제
            </button>
          )}
        </div>

        <form onSubmit={saveProduct}>
          <div className="rc-admin-product-fields">
            <label>
              <span>상품 구분</span>
              <select
                value={form.listing_type}
                onChange={(event) => {
                  const listingType = event.target.value === 'rental' ? 'rental' : 'sale';
                  setForm({
                    ...form,
                    listing_type: listingType,
                    status: listingType === 'rental' ? '렌탈가능' : '판매중',
                  });
                }}
              >
                <option value="sale">중고·리퍼 판매상품</option>
                <option value="rental">렌탈상품</option>
              </select>
            </label>

            {form.listing_type === 'rental' && (
              <label>
                <span>렌탈 유형</span>
                <select
                  value={form.rental_type}
                  onChange={(event) => setForm({
                    ...form,
                    rental_type: event.target.value === 'commercial' ? 'commercial' : 'personal',
                  })}
                >
                  <option value="personal">개인용 안마의자</option>
                  <option value="commercial">영업용(코인형) 안마의자</option>
                </select>
              </label>
            )}

            <label>
              <span>상품명</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>

            <label>
              <span>브랜드</span>
              <input
                required
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
              />
            </label>

            <label>
              <span>모델명</span>
              <input
                required
                value={form.model_name}
                onChange={(event) => setForm({ ...form, model_name: event.target.value })}
              />
            </label>

            <label>
              <span>{form.listing_type === 'rental' ? '제품 구매가 (선택)' : '판매가격'}</span>
              <input
                inputMode="numeric"
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: event.target.value.replace(/\D/g, '') })
                }
              />
            </label>

            <label>
              <span>상품등급</span>
              <select
                value={form.grade}
                onChange={(event) => setForm({ ...form, grade: event.target.value })}
              >
                <option>A급</option>
                <option>B급</option>
                <option>리퍼</option>
              </select>
            </label>

            <label>
              <span>{form.listing_type === 'rental' ? '렌탈상태' : '판매상태'}</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {form.listing_type === 'rental' ? (
                  <>
                    <option>렌탈가능</option>
                    <option>상담가능</option>
                    <option>예약중</option>
                    <option>렌탈중</option>
                    <option>노출종료</option>
                  </>
                ) : (
                  <>
                    <option>판매중</option>
                    <option>상담가능</option>
                    <option>예약중</option>
                    <option>판매완료</option>
                  </>
                )}
              </select>
            </label>

            {form.listing_type === 'rental' && (
              <>
                <label>
                  <span>월 렌탈료</span>
                  <input
                    inputMode="numeric"
                    value={form.monthly_fee}
                    onChange={(event) => setForm({
                      ...form,
                      monthly_fee: event.target.value.replace(/\D/g, ''),
                    })}
                    placeholder="예: 99000"
                  />
                </label>

                <label>
                  <span>계약기간 (개월)</span>
                  <input
                    inputMode="numeric"
                    value={form.contract_months}
                    onChange={(event) => setForm({
                      ...form,
                      contract_months: event.target.value.replace(/\D/g, ''),
                    })}
                    placeholder="예: 36"
                  />
                </label>

                <label>
                  <span>보증금</span>
                  <input
                    inputMode="numeric"
                    value={form.deposit_amount}
                    onChange={(event) => setForm({
                      ...form,
                      deposit_amount: event.target.value.replace(/\D/g, ''),
                    })}
                    placeholder="없으면 0"
                  />
                </label>

                <label>
                  <span>설치비</span>
                  <input
                    inputMode="numeric"
                    value={form.setup_fee}
                    onChange={(event) => setForm({
                      ...form,
                      setup_fee: event.target.value.replace(/\D/g, ''),
                    })}
                    placeholder="없으면 0"
                  />
                </label>

                <label className="rc-admin-product-full">
                  <span>설치 가능지역</span>
                  <input
                    value={form.installation_regions}
                    onChange={(event) => setForm({
                      ...form,
                      installation_regions: event.target.value,
                    })}
                    placeholder="예: 서울·경기 / 전국 / 수도권"
                  />
                </label>

                <label className="rc-admin-product-full">
                  <span>렌탈 조건 안내</span>
                  <textarea
                    rows={3}
                    value={form.rental_notes}
                    onChange={(event) => setForm({ ...form, rental_notes: event.target.value })}
                    placeholder="중도해지, 소유권 이전, 관리 조건 등 고객 안내 내용을 입력하세요."
                  />
                </label>
              </>
            )}

            <label>
              <span>연식</span>
              <input
                value={form.year_text}
                onChange={(event) => setForm({ ...form, year_text: event.target.value })}
              />
            </label>

            <label>
              <span>판매지역</span>
              <input
                value={form.region}
                onChange={(event) => setForm({ ...form, region: event.target.value })}
              />
            </label>

            <label>
              <span>재고수량</span>
              <input
                inputMode="numeric"
                value={form.stock_qty}
                onChange={(event) =>
                  setForm({ ...form, stock_qty: event.target.value.replace(/\D/g, '') })
                }
              />
            </label>

            <label>
              <span>AS 안내</span>
              <input
                value={form.warranty_text}
                onChange={(event) => setForm({ ...form, warranty_text: event.target.value })}
              />
            </label>

            <label className="rc-admin-product-full">
              <span>상품 설명</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
          </div>

          <div className="rc-admin-photo-manager">
            <div className="rc-admin-photo-head">
              <div>
                <h3>상품 사진 관리</h3>
                <p>첫 번째 사진이 대표 이미지로 사용됩니다.</p>
              </div>
              <label>
                사진 추가
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={choosePhotos}
                />
              </label>
            </div>

            {form.photo_urls.length === 0 && newPreviews.length === 0 ? (
              <div className="rc-admin-no-photo">등록된 상품 사진이 없습니다.</div>
            ) : (
              <>
                <div className="rc-admin-existing-photos">
                  {form.photo_urls.map((url, index) => (
                    <article key={`${url}-${index}`}>
                      <img src={url} alt={`상품 사진 ${index + 1}`} />
                      {index === 0 && <b>대표</b>}
                      <div>
                        <button type="button" onClick={() => movePhoto(index, -1)}>←</button>
                        <button type="button" onClick={() => movePhoto(index, 1)}>→</button>
                        <button type="button" onClick={() => removePhoto(index)}>삭제</button>
                      </div>
                    </article>
                  ))}
                </div>

                {newPreviews.length > 0 && (
                  <div className="rc-admin-new-photos">
                    <strong>새로 추가할 사진</strong>
                    <div>
                      {newPreviews.map((url, index) => (
                        <img src={url} alt={`새 사진 ${index + 1}`} key={url} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rc-admin-product-options">
            <label>
              <input
                type="checkbox"
                checked={form.is_visible}
                onChange={(event) =>
                  setForm({ ...form, is_visible: event.target.checked })
                }
              />
              홈페이지에 노출
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) =>
                  setForm({ ...form, is_featured: event.target.checked })
                }
              />
              추천상품
            </label>
          </div>

          <button className="rc-admin-save-button" type="submit" disabled={saving}>
            {saving ? '저장 중...' : selectedId ? '변경사항 저장' : '상품 등록'}
          </button>

          {message && <p className="rc-admin-product-message">{message}</p>}
        </form>
      </section>
    </div>
  );
}
