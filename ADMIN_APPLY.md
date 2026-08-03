# AdminScheduleCalendar.tsx 적용

## 1. import 추가

```ts
import {
  getDisplayStatus,
  getDisplayStatusClass,
  isFinalApproved,
  isReportPending,
  isReportRejected,
} from '@/lib/scheduleDisplayStatus';
```

## 2. 요약 카드 수정

기존 `i.status==='완료'` 기준 집계를 사용하지 않습니다.

```tsx
<article>
  <small>전체 일정</small>
  <strong>{items.length}</strong>
</article>

<article>
  <small>배정대기</small>
  <strong>
    {items.filter(i=>
      ['배정대기','방문예정'].includes(
        getDisplayStatus(i)
      )
    ).length}
  </strong>
</article>

<article>
  <small>진행중</small>
  <strong>
    {items.filter(i=>
      ['이동중','현장도착','작업중'].includes(
        getDisplayStatus(i)
      )
    ).length}
  </strong>
</article>

<article>
  <small>검토대기</small>
  <strong>
    {items.filter(isReportPending).length}
  </strong>
</article>

<article>
  <small>반려·재방문</small>
  <strong>
    {items.filter(isReportRejected).length}
  </strong>
</article>

<article>
  <small>승인완료</small>
  <strong>
    {items.filter(isFinalApproved).length}
  </strong>
</article>
```

## 3. 일정 카드 상태 표시 교체

기존:

```tsx
<small>{i.status}</small>
```

교체:

```tsx
<small
  className={
    'schedule-display-status '+
    getDisplayStatusClass(i)
  }
>
  {getDisplayStatus(i)}
</small>
```

기존의 별도 `보고서 검토대기` badge는 제거해도 됩니다.
일정 카드의 대표 상태 자체가 `검토대기`로 표시됩니다.

## 4. 보고서 버튼 표시

최종 보고서가 제출된 건은 `i.status==='완료'`가 아니더라도 보고서를 열 수 있어야 합니다.

```tsx
{(
  i.field_report_updated_at||
  i.completed_at||
  i.report_approval_status
)&&(
  <button
    type="button"
    onClick={()=>{
      setReportScheduleId(i.id);
      setSelected(null);
    }}
  >
    작업보고 보기
  </button>
)}
```

## 5. 보고서 창 닫기 후 즉시 갱신

기존 구조를 유지합니다.

```tsx
<AdminFieldReport
  scheduleId={reportScheduleId}
  onUpdated={()=>{
    void load();
  }}
  onClose={()=>{
    setReportScheduleId(null);
    void load();
  }}
/>
```

## 6. 반려 사유 표시

```tsx
{isReportRejected(i)&&
  i.report_rejection_reason&&(
    <em className="schedule-rejection-reason">
      {i.report_rejection_reason}
    </em>
  )}
```
