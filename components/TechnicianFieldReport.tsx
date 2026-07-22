'use client';

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type Photo={
  id:string;
  photo_type:string;
  photo_url:string;
};

type Report={
  id:string;
  customer_name?:string;
  service_type?:string;
  symptom_text?:string|null;
  action_text?:string|null;
  replaced_parts?:string|null;
  customer_confirmation?:string|null;
  customer_signature_url?:string|null;
  service_schedule_photos?:Photo[];
};

const photoTypes=[
  ['front','제품 정면'],
  ['side','제품 측면'],
  ['label','제품 라벨'],
  ['after','작업 후'],
  ['part','교체 부품'],
  ['receipt','영수증'],
] as const;

export default function TechnicianFieldReport({
  scheduleId,
  onClose,
}:{
  scheduleId:string;
  onClose:()=>void;
}){
  const [report,setReport]=useState<Report|null>(null);
  const [symptom,setSymptom]=useState('');
  const [action,setAction]=useState('');
  const [parts,setParts]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [uploadingType,setUploadingType]=useState<string|null>(null);
  const [signatureSaving,setSignatureSaving]=useState(false);

  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);
  const hasDrawingRef=useRef(false);

  async function load(){
    try{
      const response=await fetch(
        `/api/technician/assignments/${scheduleId}/report`,
        {
          cache:'no-store',
        }
      );

      const result=await response.json();

      if(!response.ok){
        setMessage(result.error||'작업보고 조회 오류');
        return;
      }

      setReport(result.data);
      setSymptom(result.data.symptom_text||'');
      setAction(result.data.action_text||'');
      setParts(result.data.replaced_parts||'');
      setConfirmation(result.data.customer_confirmation||'');
    }catch(error){
      console.error('field report load error',error);
      setMessage('작업보고를 불러오지 못했습니다.');
    }
  }

  useEffect(()=>{
    load();
  },[scheduleId]);

  async function saveReport(){
    try{
      setSaving(true);
      setMessage('작업보고를 저장하고 있습니다.');

      const response=await fetch(
        `/api/technician/assignments/${scheduleId}/report`,
        {
          method:'PATCH',
          headers:{
            'Content-Type':'application/json',
          },
          body:JSON.stringify({
            symptom_text:symptom,
            action_text:action,
            replaced_parts:parts,
            customer_confirmation:confirmation,
          }),
        }
      );

      const result=await response.json();

      if(!response.ok){
        setMessage(result.error||'작업보고 저장 오류');
        return;
      }

      setMessage('작업보고가 저장되었습니다.');
      await load();
    }catch(error){
      console.error('field report save error',error);
      setMessage('작업보고 저장 요청을 처리하지 못했습니다.');
    }finally{
      setSaving(false);
    }
  }
  function readImage(file:File):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const url=URL.createObjectURL(file);

    image.onload=()=>{
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror=()=>{
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했습니다.'));
    };

    image.src=url;
  });
}

async function compressPhoto(file:File):Promise<File>{
  // 이미 충분히 작으면 원본을 사용
  if(file.size<=2.5*1024*1024){
    return file;
  }

  const image=await readImage(file);

  const maxWidth=1920;
  const maxHeight=1920;

  const ratio=Math.min(
    1,
    maxWidth/image.width,
    maxHeight/image.height
  );

  const width=Math.max(
    1,
    Math.round(image.width*ratio)
  );

  const height=Math.max(
    1,
    Math.round(image.height*ratio)
  );

  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;

  const context=canvas.getContext('2d');

  if(!context){
    throw new Error('사진 압축 기능을 사용할 수 없습니다.');
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  const qualities=[0.8,0.7,0.6,0.5];

  for(const quality of qualities){
    const blob=await new Promise<Blob|null>(resolve=>{
      canvas.toBlob(
        resolve,
        'image/jpeg',
        quality
      );
    });

    if(blob&&blob.size<=2.5*1024*1024){
      return new File(
        [blob],
        `${Date.now()}.jpg`,
        {
          type:'image/jpeg',
          lastModified:Date.now(),
        }
      );
    }
  }

  const finalBlob=await new Promise<Blob|null>(resolve=>{
    canvas.toBlob(
      resolve,
      'image/jpeg',
      0.45
    );
  });

  if(!finalBlob){
    throw new Error('사진 압축에 실패했습니다.');
  }

  return new File(
    [finalBlob],
    `${Date.now()}.jpg`,
    {
      type:'image/jpeg',
      lastModified:Date.now(),
    }
  );
}
  async function uploadPhoto(
  type:string,
  file?:File
){
  if(!file){
    return;
  }

  try{
    setUploadingType(type);
    setMessage('사진을 최적화하고 있습니다.');

    const uploadFile=await compressPhoto(file);

    if(uploadFile.size>3.5*1024*1024){
      setMessage(
        '사진 용량이 너무 큽니다. 카메라 해상도를 낮추거나 다른 사진을 선택하세요.'
      );
      return;
    }

    setMessage('사진을 업로드하고 있습니다.');

    const form=new FormData();
    form.append('photo_type',type);
    form.append('file',uploadFile);

    const response=await fetch(
      `/api/technician/assignments/${scheduleId}/report`,
      {
        method:'POST',
        body:form,
      }
    );

    const contentType=
      response.headers.get('content-type')||'';

    let result:any=null;

    if(contentType.includes('application/json')){
      result=await response.json();
    }else{
      const text=await response.text();

      result={
        error:
          response.status===413
            ? '사진 용량이 서버 허용 크기를 초과했습니다.'
            : text||'사진 업로드 오류',
      };
    }

    if(response.status===401){
      setMessage('기사 로그인이 필요합니다.');
      return;
    }

    if(!response.ok){
      setMessage(
        result?.error||
        `사진 업로드 오류 (${response.status})`
      );
      return;
    }

    setMessage('사진이 등록되었습니다.');

    await load();
  }catch(error){
    console.error('photo upload client error',error);

    setMessage(
      error instanceof Error
        ? error.message
        : '사진 업로드 요청을 처리하지 못했습니다.'
    );
  }finally{
    setUploadingType(null);
  }
}
  async function saveSignature(){
    const canvas=canvasRef.current;

    if(!canvas||!hasDrawingRef.current){
      setMessage('고객 서명을 먼저 작성하세요.');
      return;
    }

    try{
      setSignatureSaving(true);
      setMessage('고객 서명을 저장하고 있습니다.');

      const response=await fetch(
        `/api/technician/assignments/${scheduleId}/signature`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
          },
          body:JSON.stringify({
            signature_data_url:canvas.toDataURL('image/png'),
          }),
        }
      );

      const result=await response.json();

      if(!response.ok){
        setMessage(result.error||'고객 서명 저장 오류');
        return;
      }

      setMessage('고객 서명이 저장되었습니다.');
      await load();
    }catch(error){
      console.error('signature save error',error);
      setMessage('고객 서명 저장 요청을 처리하지 못했습니다.');
    }finally{
      setSignatureSaving(false);
    }
  }

  const photos=report?.service_schedule_photos||[];

  return (
    <div
      className="field-report-backdrop"
      onClick={onClose}
    >
      <div
        className="field-report-panel"
        onClick={event=>event.stopPropagation()}
      >
        <header>
          <div>
            <p>FIELD SERVICE REPORT</p>
            <h2>{report?.customer_name||'현장 작업보고'}</h2>
            <span>{report?.service_type||'서비스 정보 없음'}</span>
          </div>

          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {message&&(
          <aside>
            {message}
          </aside>
        )}

        <section className="report-form-grid">
          <label>
            <span>고객 증상</span>
            <textarea
              value={symptom}
              onChange={event=>setSymptom(event.target.value)}
              placeholder="고객이 설명한 증상과 점검 전 상태를 입력하세요."
            />
          </label>

          <label>
            <span>조치 내용</span>
            <textarea
              value={action}
              onChange={event=>setAction(event.target.value)}
              placeholder="점검 결과와 수리·조정 내용을 입력하세요."
            />
          </label>

          <label>
            <span>교체 부품</span>
            <textarea
              value={parts}
              onChange={event=>setParts(event.target.value)}
              placeholder="부품명과 수량, 회수 여부를 입력하세요."
            />
          </label>

          <label>
            <span>고객 확인사항</span>
            <textarea
              value={confirmation}
              onChange={event=>setConfirmation(event.target.value)}
              placeholder="비용과 보증, 사용방법 등 안내사항을 입력하세요."
            />
          </label>
        </section>

        <button
          type="button"
          className="primary"
          disabled={saving}
          onClick={saveReport}
        >
          {saving?'저장 중':'작업보고 저장'}
        </button>

        <section className="report-photo-section">
          <h3>현장 사진</h3>

          <div className="report-photo-grid">
            {photoTypes.map(([type,label])=>{
              const found=photos
                .filter(photo=>photo.photo_type===type)
                .at(-1);

              const uploading=uploadingType===type;

              return (
                <label
                  key={type}
                  className="photo-slot"
                >
                  <b>{label}</b>

                  {found?(
  <div className="photo-preview-box">
    <a
      href={found.photo_url}
      target="_blank"
      rel="noreferrer"
    >
      <img
        src={found.photo_url}
        alt={label}
      />
    </a>

    <div className="photo-edit-actions">
      <label className="photo-replace-button">
        사진 교체
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={uploading}
          onChange={event=>{
            const file=event.currentTarget.files?.[0];

            void uploadPhoto(type,file);

            event.currentTarget.value='';
          }}
        />
      </label>

      <button
        type="button"
        className="photo-delete-button"
        onClick={()=>deletePhoto(found.id)}
      >
        삭제
      </button>
    </div>
  </div>
):(
  <>
    <span>
      {uploading?'업로드 중':'사진 없음'}
    </span>

    <input
      type="file"
      accept="image/*"
      capture="environment"
      disabled={uploading}
      onChange={event=>{
        const file=event.currentTarget.files?.[0];

        void uploadPhoto(type,file);

        event.currentTarget.value='';
      }}
    />
  </>
)}
        <section className="signature-section">
          <div>
            <h3>고객 서명</h3>
            <p>
              작업내용을 확인한 고객이 아래 칸에 서명합니다.
            </p>
          </div>

          {report?.customer_signature_url?(
  <div className="saved-signature-wrap">
    <a
      href={report.customer_signature_url}
      target="_blank"
      rel="noreferrer"
      className="saved-signature"
    >
      <img
        src={report.customer_signature_url}
        alt="고객 서명"
      />
    </a>

    <button
      type="button"
      onClick={resetSignature}
    >
      서명 다시 받기
    </button>
  </div>
):(
            <>
              <canvas
                ref={canvasRef}
                width={900}
                height={260}
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerCancel={stopDraw}
                onPointerLeave={stopDraw}
              />

              <div className="signature-actions">
                <button
                  type="button"
                  onClick={clearSignature}
                >
                  다시 쓰기
                </button>

                <button
                  type="button"
                  className="primary"
                  disabled={signatureSaving}
                  onClick={saveSignature}
                >
                  {signatureSaving?'저장 중':'서명 저장'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
async function resetSignature(){
  const confirmed=window.confirm(
    '기존 고객 서명을 삭제하고 다시 받으시겠습니까?'
  );

  if(!confirmed){
    return;
  }

  const response=await fetch(
    `/api/technician/assignments/${scheduleId}/signature`,
    {
      method:'DELETE',
    }
  );

  const result=await response.json();

  if(!response.ok){
    setMessage(result.error||'서명 초기화 오류');
    return;
  }

  setMessage('기존 서명이 삭제되었습니다.');
  await load();
}
