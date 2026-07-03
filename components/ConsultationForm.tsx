'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';

type PhotoKey = 'front' | 'side' | 'label' | 'back';

type PreviewMap = Partial<Record<PhotoKey, string>>;

type Status = 'idle' | 'sending' | 'done' | 'error';

const photoGuides: Array<{
  key: PhotoKey;
  title: string;
  description: string;
  badge: string;
}> = [
  {
    key: 'front',
    title: '앞면 사진',
    description: '전체 외관과 가죽 상태가 보이게 촬영',
    badge: 'FRONT',
  },
  {
    key: 'side',
    title: '옆면 사진',
    description: '팔걸이, 다리부, 측면 커버 상태 확인',
    badge: 'SIDE',
  },
  {
    key: 'label',
    title: '모델명 / 제품라벨',
    description: '뒷면 또는 하단의 모델명 라벨을 선명하게 촬영',
    badge: 'LABEL',
  },
  {
    key: 'back',
    title: '뒷면 사진',
    description: '전원선, 후면 커버, 파손 여부 확인',
    badge: 'BACK',
  },
];

export default function ConsultationForm() {
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [status, setStatus] = useState<Status>('idle');

  const uploadedCount = useMemo(() => Object.values(previews).filter(Boolean).length, [previews]);

  function handlePhotoChange(key: PhotoKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [key]: url }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('submit failed');

      setStatus('done');
      form.reset();
      setPreviews({});
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  }

  return (
    <section id="consult" className="consultSection">
      <div className="consultWrap">
        <div className="consultCopy">
          <p className="eyebrow">Free Quote</p>
          <h2>사진만 보내도 빠르게 상담받을 수 있습니다.</h2>
          <p>
            중고 구매·판매, 이전설치, 폐기수거, 출장수리, 부품문의 중 필요한 서비스를 선택해 주세요.
            제품 상태 사진을 함께 보내주시면 더 정확하게 안내할 수 있습니다.
          </p>
          <div className="photoHelpBox">
            <strong>사진 등록 가이드</strong>
            <span>앞면 · 옆면 · 모델명 라벨 · 뒷면 사진을 권장합니다.</span>
          </div>
        </div>

        <form className="consultForm" onSubmit={onSubmit}>
          <div className="grid2">
            <input name="name" placeholder="이름" required />
            <input name="phone" placeholder="연락처" required />
          </div>

          <select name="service" required>
            <option>중고 안마의자 구매</option>
            <option>내 안마의자 판매</option>
            <option>이전설치</option>
            <option>폐기수거</option>
            <option>출장수리</option>
            <option>부품구매</option>
          </select>

          <input name="region" placeholder="지역 예: 경기 고양시" />
          <input name="model" placeholder="브랜드/모델명 예: 코지마 CMC-A100" />
          <textarea name="message" placeholder="문의 내용을 적어주세요" />

          <div className="photoUploadArea">
            <div className="photoUploadHead">
              <div>
                <strong>제품 상태 사진 첨부</strong>
                <p>판매/매입 상담은 사진이 많을수록 견적이 빨라집니다.</p>
              </div>
              <span>{uploadedCount}/4</span>
            </div>

            <div className="photoGuideGrid">
              {photoGuides.map((item) => (
                <label className="photoGuideCard" key={item.key}>
                  <input
                    type="file"
                    name={`${item.key}Photo`}
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handlePhotoChange(item.key, event)}
                  />
                  {previews[item.key] ? (
                    <img src={previews[item.key]} alt={`${item.title} 미리보기`} />
                  ) : (
                    <div className="photoPlaceholder">
                      <b>{item.badge}</b>
                      <span>+ 사진 첨부</span>
                    </div>
                  )}
                  <div className="photoGuideText">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? '접수 중...' : '무료 상담 신청'}
          </button>

          {status === 'done' && (
            <p className="formSuccess">접수되었습니다. 담당자가 순차적으로 연락드립니다.</p>
          )}
          {status === 'error' && (
            <p className="formError">접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
          )}
        </form>
      </div>
    </section>
  );
}
