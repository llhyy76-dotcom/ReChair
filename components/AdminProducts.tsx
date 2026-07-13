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
};

type ProductForm = {
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
};

const emptyForm: ProductForm = {
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
};

function toForm(product?: Product): ProductForm {
  if (!product) return emptyForm;

  const photos = Array.isArray(product.photo_urls)
    ? product.photo_urls
    : product.thumbnail_url
      ? [product.thumbnail_url]
      : [];

  return {
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
              <strong>{product.title}</strong>
              <span>{product.brand} · {product.model_name}</span>
              <small>
                {Number(product.price || 0).toLocaleString('ko-KR')}원 · {product.status}
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
              <span>판매가격</span>
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
              <span>판매상태</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option>판매중</option>
                <option>상담가능</option>
                <option>예약중</option>
                <option>판매완료</option>
              </select>
            </label>

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
