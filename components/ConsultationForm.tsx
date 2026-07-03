'use client';

import { useMemo, useState } from 'react';

const photoGuide = [
  { key: 'frontPhoto', title: '앞면 사진', desc: '전체 외관과 사용감 확인', icon: '🪑' },
  { key: 'sidePhoto', title: '옆면 사진', desc: '팔걸이·가죽·프레임 상태 확인', icon: '↔️' },
  { key: 'labelPhoto', title: '모델명/제품라벨', desc: '정확한 모델명·제조정보 확인', icon: '🏷️' },
  { key: 'backPhoto', title: '뒷면 사진', desc: '후면 커버·전원부·파손 여부 확인', icon: '🔌' }
];

type PreviewMap = Record<string, string>;

export default function ConsultationForm() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<PreviewMap>({});

  const hasPreview = useMemo(() => Object.keys(previews).length > 0, [previews]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>, key: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [key]: url }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setDone(false);

    const form = new FormData(e.currentTarget);

    try {
      await fetch('/api/consultations', {
        method: 'POST',
        body: form
      });
      setDone(true);
      e.currentTarget.reset();
      setPreviews({});
    } catch {
      alert('접수 저장은 DB/Storage 연결 후 활성화됩니다. 현재는 화면 접수 테스트 단계입니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="consult" className="section quoteSection">
      <div className="quoteWrap">
        <div className="quoteCopy">
          <b>Free Quote</b>
          <h2>사진만 보내도 빠르게 상담받을 수 있습니다.</h2>
          <p>
            중고 구매·판매, 이전설치, 폐기수거, 출장수리, 부품문의 중 필요한 서비스를 선택해 주세요.
            판매/매입 상담은 아래 4가지 사진을 올려주시면 훨씬 빠르게 확인할 수 있습니다.
          </p>
          <div className="photoGuideList">
            {photoGuide.map((item, index) => (
              <div className="photoGuideItem" key={item.key}>
                <span>{index + 1}</span>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </div>
            ))}
          </div>
        </div>

        <form className="formBox quoteForm" onSubmit={onSubmit}>
          <div className="grid2">
            <input name="name" placeholder="이름" required />
            <input name="phone" placeholder="연락처" required />
          </div>

          <div className="grid2" style={{ marginTop: 14 }}>
            <select name="service" defaultValue="내 안마의자 판매">
              <option>중고 안마의자 구매</option>
              <option>내 안마의자 판매</option>
              <option>이전설치</option>
              <option>폐기수거</option>
              <option>출장수리</option>
              <option>부품구매</option>
            </select>
            <input name="region" placeholder="지역 예: 경기 고양시" />
          </div>

          <input
            style={{ marginTop: 14 }}
            name="model"
            placeholder="브랜드/모델명 예: 코지마 CMC-A100"
          />

          <div className="uploadGuide">
            <div>
              <strong>제품 상태 사진 첨부</strong>
              <p>앞면, 옆면, 모델명 라벨, 뒷면 사진을 올려주세요.</p>
            </div>
            <small>JPG/PNG 권장</small>
          </div>

          <div className="photoUploadGrid">
            {photoGuide.map((item) => (
              <label className="photoUploadCard" key={item.key}>
                <input
                  type="file"
                  name={item.key}
                  accept="image/*"
                  onChange={(e) => onFileChange(e, item.key)}
                />
                {previews[item.key] ? (
                  <img src={previews[item.key]} alt={item.title} />
                ) : (
                  <div className="photoPlaceholder">
                    <em>{item.icon}</em>
                    <strong>{item.title}</strong>
                    <small>{item.desc}</small>
                  </div>
                )}
              </label>
            ))}
          </div>

          {hasPreview && <p className="uploadHint">첨부 사진은 관리자 화면에서 제품 상태 확인용으로 사용됩니다.</p>}

          <textarea style={{ marginTop: 14 }} name="message" placeholder="문의 내용을 적어주세요" />
          <button disabled={loading}>{loading ? '접수 중...' : '무료 상담 신청'}</button>
          {done && <p style={{ color: '#2563eb', fontWeight: 900 }}>접수되었습니다. 담당자가 연락드립니다.</p>}
        </form>
      </div>
    </section>
  );
}
