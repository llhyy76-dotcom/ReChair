'use client';

import { useMemo, useState } from 'react';

const photoFields = [
  { name: 'photo_front', label: '앞면 사진', hint: '안마의자 전체 앞모습' },
  { name: 'photo_side', label: '옆면 사진', hint: '좌/우 측면 상태 확인' },
  { name: 'photo_label', label: '모델명/제품라벨', hint: '모델명·제조번호가 보이게' },
  { name: 'photo_back', label: '뒷면 사진', hint: '전원부·후면 커버 확인' },
];

export default function ConsultationForm() {
  const [status, setStatus] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const previewItems = useMemo(() => photoFields.map((field) => ({ ...field, src: previews[field.name] })), [previews]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>, name: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviews((prev) => ({ ...prev, [name]: URL.createObjectURL(file) }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus('접수 중입니다...');

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '상담 접수에 실패했습니다.');
      setStatus('상담 신청이 접수되었습니다. 빠르게 연락드리겠습니다.');
      event.currentTarget.reset();
      setPreviews({});
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '상담 접수 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="consult" className="consult-section">
      <div className="section-head">
        <p className="eyebrow">FREE CONSULTATION</p>
        <h2>사진만 올려도 빠르게 상담해 드립니다.</h2>
        <p>앞면, 옆면, 제품라벨, 뒷면 사진을 올리면 제품 상태 확인과 견적 상담이 빨라집니다.</p>
      </div>

      <form className="consult-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            <span>이름</span>
            <input name="customer_name" placeholder="홍길동" required />
          </label>
          <label>
            <span>연락처</span>
            <input name="phone" placeholder="010-0000-0000" required />
          </label>
          <label>
            <span>지역</span>
            <input name="region" placeholder="예: 경기 고양시" />
          </label>
          <label>
            <span>서비스</span>
            <select name="service_type" defaultValue="중고판매">
              <option>중고판매</option>
              <option>중고구매</option>
              <option>출장수리</option>
              <option>이전설치</option>
              <option>폐기수거</option>
              <option>부품구매</option>
            </select>
          </label>
          <label>
            <span>브랜드</span>
            <input name="brand" placeholder="코지마, 세라젬, 바디프랜드 등" />
          </label>
          <label>
            <span>모델명</span>
            <input name="model_name" placeholder="제품 라벨에 적힌 모델명" />
          </label>
        </div>

        <label className="full">
          <span>문의내용</span>
          <textarea name="message" placeholder="제품 상태, 사용기간, 고장증상, 희망가격 등을 적어주세요." />
        </label>

        <div className="photo-upload-block">
          <div className="photo-upload-title">
            <h3>제품 사진 업로드</h3>
            <p>휴대폰에서는 파일 선택 시 카메라 촬영도 가능합니다.</p>
          </div>
          <div className="photo-grid">
            {previewItems.map((field, index) => (
              <label className="photo-card" key={field.name}>
                <input
                  type="file"
                  name={field.name}
                  accept="image/*"
                  capture={index === 2 ? undefined : 'environment'}
                  onChange={(event) => handleFileChange(event, field.name)}
                />
                <div className="photo-preview">
                  {field.src ? <img src={field.src} alt={field.label} /> : <span>📷</span>}
                </div>
                <strong>{field.label}</strong>
                <small>{field.hint}</small>
              </label>
            ))}
          </div>
        </div>

        <button className="primary-btn" disabled={loading} type="submit">
          {loading ? '접수 중...' : '무료 상담 신청'}
        </button>
        {status && <p className="form-status">{status}</p>}
      </form>
    </section>
  );
}
