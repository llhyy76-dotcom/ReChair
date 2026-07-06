'use client';

import { useState } from 'react';

const photoFields = [
  { key: 'front', title: '앞면', help: '전체 정면 사진' },
  { key: 'side', title: '옆면', help: '팔걸이·가죽 상태' },
  { key: 'label', title: '제품라벨', help: '모델명 라벨' },
  { key: 'back', title: '뒷면', help: '후면 커버·전원부' },
];

export default function ConsultationForm() {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  function onFile(key: string, file?: File) {
    if (!file) return;
    setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('접수 중입니다...');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/consultations', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('submit failed');
      setMessage('상담 신청이 접수되었습니다. 담당자가 순차적으로 연락드립니다.');
      event.currentTarget.reset();
      setPreviews({});
    } catch {
      setMessage('접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <section id="consult" className="consult-section">
      <div className="consult-copy">
        <span>Free Quote</span>
        <h2>사진만 보내도 빠르게 상담받을 수 있습니다.</h2>
        <p>중고 구매·판매, 이전설치, 폐기수거, 출장수리, 부품문의 중 필요한 서비스를 선택해 주세요.</p>
      </div>
      <form className="consult-form" onSubmit={onSubmit}>
        <div className="form-row">
          <input name="name" placeholder="이름" required />
          <input name="phone" placeholder="연락처" required />
        </div>
        <select name="service" defaultValue="중고 안마의자 판매">
          <option>중고 안마의자 판매</option>
          <option>중고 안마의자 구매</option>
          <option>이전설치</option>
          <option>폐기수거</option>
          <option>출장수리</option>
          <option>부품문의</option>
        </select>
        <input name="model" placeholder="브랜드/모델명 예: 코지마 CMC-A100" />
        <textarea name="message" placeholder="문의 내용을 적어주세요" />

        <div className="photo-guide-title">
          <strong>제품 사진 첨부</strong>
          <span>앞면·옆면·라벨·뒷면을 올려주시면 상담이 빨라집니다.</span>
        </div>
        <div className="photo-upload-grid">
          {photoFields.map((field) => (
            <label className="photo-upload" key={field.key}>
              <div className="photo-example">{previews[field.key] ? <img src={previews[field.key]} alt={`${field.title} 미리보기`} /> : <span>📷</span>}</div>
              <strong>{field.title}</strong>
              <small>{field.help}</small>
              <input
                type="file"
                name={`photo_${field.key}`}
                accept="image/*"
                capture="environment"
                onChange={(event) => onFile(field.key, event.target.files?.[0])}
              />
            </label>
          ))}
        </div>
        <button className="form-submit" type="submit">무료 상담 신청</button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
