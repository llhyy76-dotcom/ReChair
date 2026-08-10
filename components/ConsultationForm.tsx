'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const SERVICE_OPTIONS = [
  { key: 'buy', label: '중고구매' },
  { key: 'sell', label: '중고판매' },
  { key: 'move', label: '이전설치' },
  { key: 'dispose', label: '폐기수거' },
  { key: 'repair', label: '출장수리' },
  { key: 'parts', label: '부품구매' },
  { key: 'rental-personal', label: '개인용 안마의자 렌탈' },
  { key: 'rental-commercial', label: '영업용(코인형) 안마의자 렌탈' },
] as const;

type ServiceKey = (typeof SERVICE_OPTIONS)[number]['key'];
type PhotoKey = 'photo_front' | 'photo_side' | 'photo_label' | 'photo_back';

type ProductSummary = {
  id: string;
  title: string;
  brand: string;
  model_name: string;
  price: number;
  thumbnail_url?: string | null;
};

type PreviewMap = Partial<Record<PhotoKey, string>>;
type FileMap = Partial<Record<PhotoKey, File>>;

const PHOTO_ITEMS: Array<{ key: PhotoKey; title: string; guide: string }> = [
  { key: 'photo_front', title: '앞면 사진', guide: '안마의자 전체 앞모습' },
  { key: 'photo_side', title: '옆면 사진', guide: '좌·우 측면 상태 확인' },
  { key: 'photo_label', title: '모델명/제품라벨', guide: '모델명과 제조번호가 보이게' },
  { key: 'photo_back', title: '뒷면 사진', guide: '전원부와 후면 커버 확인' },
];

function serviceLabel(key: string | null): string {
  return SERVICE_OPTIONS.find((item) => item.key === key)?.label ?? '';
}

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });

  if (!blob) return file;

  const cleanName = file.name.replace(/\.[^.]+$/, '') || 'rechair-photo';
  return new File([blob], `${cleanName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export default function ConsultationForm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [fixedService, setFixedService] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [files, setFiles] = useState<FileMap>({});
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = params.get('service');
    const productId = params.get('product');

    setFixedService(serviceLabel(service));

    if (productId) {
      setProductLoading(true);
      fetch(`/api/products/${productId}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result?.error || '상품 정보를 불러오지 못했습니다.');
          setSelectedProduct(result.data || null);
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : '상품 정보 조회 오류');
        })
        .finally(() => setProductLoading(false));
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previews]);

  const hasFixedService = useMemo(() => Boolean(fixedService), [fixedService]);

  function inferRegion(value: string) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    const metro = ['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시'];
    if (metro.includes(parts[0])) {
      const city = parts[0].replace('특별시','').replace('광역시','').replace('특별자치시','');
      return [city, parts[1] || ''].filter(Boolean).join(' ');
    }
    if (parts[0].endsWith('도')) {
      return [parts[1] || '', parts[2] && /(구|군)$/.test(parts[2]) ? parts[2] : ''].filter(Boolean).join(' ');
    }
    return parts.slice(0, 2).join(' ');
  }

  function applyAddress(value: string) {
    setAddress(value);
    const nextRegion = inferRegion(value);
    if (nextRegion) setRegion(nextRegion);
  }

  function openAddressSearch() {
    const w = window as any;
    const launch = () => new w.daum.Postcode({
      oncomplete: (data: any) => {
        const nextAddress = data.roadAddress || data.jibunAddress || data.address || '';
        applyAddress(nextAddress);
      },
    }).open();

    if (w.daum?.Postcode) {
      launch();
      return;
    }

    const existing = document.getElementById('daum-postcode-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', launch, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.onload = launch;
    script.onerror = () => setErrorMessage('주소 검색을 불러오지 못했습니다. 주소를 직접 입력해 주세요.');
    document.head.appendChild(script);
  }

  function handlePhotoChange(key: PhotoKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const previous = previews[key];
    if (previous) URL.revokeObjectURL(previous);

    setFiles((current) => ({ ...current, [key]: file }));
    setPreviews((current) => ({ ...current, [key]: URL.createObjectURL(file) }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setReceiptNumber('');

    try {
      const sourceForm = new FormData(event.currentTarget);
      const payload = new FormData();

      for (const [key, value] of sourceForm.entries()) {
        if (!(value instanceof File) || value.size > 0) {
          payload.append(key, value);
        }
      }

      if (hasFixedService) {
        payload.set('service_type', fixedService);
      }

      if (selectedProduct) {
        payload.set('product_id', selectedProduct.id);
        payload.set('product_title', selectedProduct.title);
      }

      for (const item of PHOTO_ITEMS) {
        const original = files[item.key];
        if (!original) continue;
        const compressed = await compressImage(original);
        payload.set(item.key, compressed);
      }

      const response = await fetch('/api/consultations', {
        method: 'POST',
        body: payload,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || result?.message || '상담 신청을 저장하지 못했습니다.');
      }

      const receipt =
        result?.data?.id ||
        result?.id ||
        `RC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;

      setReceiptNumber(receipt);
      formRef.current?.reset();

      Object.values(previews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });

      setFiles({});
      setPreviews({});
      setAddress('');
      setRegion('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '상담 신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (receiptNumber) {
    return (
      <section className="consult-section rc-consult-section" id="consult">
        <div className="container">
          <div className="rc-consult-success">
            <span className="rc-success-icon">✓</span>
            <p className="eyebrow">CONSULTATION COMPLETE</p>
            <h2>상담 신청이 완료되었습니다.</h2>
            <p>담당자가 접수 내용을 확인한 뒤 순차적으로 연락드리겠습니다.</p>
            <div className="rc-receipt-number">
              <small>접수번호</small>
              <strong>{receiptNumber}</strong>
            </div>
            <button type="button" onClick={() => setReceiptNumber('')}>
              추가 상담 신청
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="consult-section rc-consult-section" id="consult">
      <div className="container rc-consult-container">
        <div className="rc-consult-heading">
          <p className="eyebrow">FREE CONSULTATION</p>
          <h2>무료 상담 신청</h2>
          <p>필요한 정보를 남겨주시면 담당자가 확인 후 연락드립니다.</p>
        </div>

        {productLoading && <div className="rc-selected-product loading">상품 정보를 불러오는 중입니다.</div>}

        {selectedProduct && (
          <div className="rc-selected-product">
            <div className="rc-selected-product-image">
              {selectedProduct.thumbnail_url ? (
                <img src={selectedProduct.thumbnail_url} alt={selectedProduct.title} />
              ) : (
                <span>💺</span>
              )}
            </div>
            <div>
              <small>선택한 구매상담 상품</small>
              <strong>{selectedProduct.title}</strong>
              <p>{selectedProduct.brand} · {selectedProduct.model_name}</p>
              <b>{formatPrice(selectedProduct.price)}</b>
            </div>
          </div>
        )}

        <form ref={formRef} className="rc-consult-form" onSubmit={handleSubmit}>
          <div className="rc-form-grid">
            <label>
              <span>이름</span>
              <input name="customer_name" required placeholder="이름을 입력해 주세요" />
            </label>

            <label>
              <span>연락처</span>
              <input name="phone" required inputMode="tel" placeholder="010-0000-0000" />
            </label>

            <label className="rc-full">
              <span>방문 주소</span>
              <div className="rc-address-input-row">
                <input
                  name="address"
                  required
                  value={address}
                  onChange={(event) => applyAddress(event.target.value)}
                  placeholder="도로명 주소를 검색하거나 직접 입력해 주세요"
                />
                <button type="button" onClick={openAddressSearch}>주소 검색</button>
              </div>
            </label>

            <label>
              <span>지역 (자동 입력)</span>
              <input
                name="region"
                required
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                placeholder="예: 고양시 덕양구"
              />
            </label>

            <label>
              <span>서비스</span>
              {hasFixedService ? (
                <>
                  <div className="rc-fixed-service">
                    <b>{fixedService}</b>
                    <small>선택한 서비스로 접수됩니다.</small>
                  </div>
                  <input type="hidden" name="service_type" value={fixedService} />
                </>
              ) : (
                <select name="service_type" required defaultValue="">
                  <option value="" disabled>원하는 서비스를 선택해 주세요</option>
                  {SERVICE_OPTIONS.map((item) => (
                    <option value={item.label} key={item.key}>{item.label}</option>
                  ))}
                </select>
              )}
            </label>

            <label>
              <span>브랜드</span>
              <input
                name="brand"
                defaultValue={selectedProduct?.brand || ''}
                placeholder="코지마, 세라젬, 바디프랜드 등"
              />
            </label>

            <label>
              <span>모델명</span>
              <input
                name="model_name"
                defaultValue={selectedProduct?.model_name || ''}
                placeholder="제품 라벨에 적힌 모델명"
              />
            </label>

            <label className="rc-full">
              <span>문의내용</span>
              <textarea
                name="message"
                rows={6}
                defaultValue={selectedProduct ? `${selectedProduct.title} 구매 상담을 신청합니다.` : ''}
                placeholder="자세한 문의 내용을 적어 주세요"
              />
            </label>
          </div>

          <div className="rc-photo-section">
            <div className="rc-photo-title">
              <h3>제품 사진 업로드</h3>
              <p>중고 판매·수리·부품 문의 시 사진을 올려주시면 더욱 빠르게 확인할 수 있습니다.</p>
            </div>

            <div className="rc-upload-grid">
              {PHOTO_ITEMS.map((item) => (
                <label className="rc-upload-card" key={item.key}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handlePhotoChange(item.key, event)}
                  />
                  <div className="rc-upload-preview">
                    {previews[item.key] ? (
                      <img src={previews[item.key]} alt={`${item.title} 미리보기`} />
                    ) : (
                      <span>＋</span>
                    )}
                  </div>
                  <strong>{item.title}</strong>
                  <small>{item.guide}</small>
                  <em>{previews[item.key] ? '사진 변경' : '사진 선택'}</em>
                </label>
              ))}
            </div>
          </div>

          {errorMessage && <p className="rc-form-error">{errorMessage}</p>}

          <button className="rc-submit-button" type="submit" disabled={submitting}>
            {submitting ? '사진 압축 및 접수 중...' : '무료 상담 신청'}
          </button>
        </form>
      </div>
    </section>
  );
}
