# TechnicianMobileApp.tsx 적용

## 1. import 추가

기존 import 영역에 추가합니다.

```ts
import {
  getDisplayStatus,
  getDisplayStatusClass,
  isFinalApproved,
  isReportPending,
  isReportRejected,
  isVisitActionable,
} from '@/lib/scheduleDisplayStatus';
```

## 2. Assignment 타입에 필드 추가

```ts
field_report_updated_at?:string|null;
report_approval_status?:string|null;
report_rejection_reason?:string|null;
report_reviewed_at?:string|null;
```

## 3. 기존 summary 계산을 교체

```ts
const summary=useMemo(()=>({
  total:items.length,

  waiting:items.filter(item=>
    ['배정대기','방문예정'].includes(
      getDisplayStatus(item)
    )
  ).length,

  active:items.filter(item=>
    ['이동중','현장도착','작업중'].includes(
      getDisplayStatus(item)
    )
  ).length,

  reviewPending:items.filter(
    isReportPending
  ).length,

  rejected:items.filter(
    isReportRejected
  ).length,

  done:items.filter(
    isFinalApproved
  ).length,
}),[items]);
```

진행률도 최종 승인 기준으로 유지합니다.

```ts
const progress=
  summary.total===0
    ?0
    :Math.round(
        (summary.done/summary.total)*100
      );
```

## 4. 다음 방문 계산 교체

검토대기 건이 다음 방문 카드에 다시 나타나지 않게 합니다.

```ts
const nextItem=useMemo(
  ()=>items.find(isVisitActionable)||null,
  [items]
);
```

## 5. 상태 문구 출력 교체

기존:

```tsx
{statusLabel(item.status)}
```

교체:

```tsx
{getDisplayStatus(item)}
```

상태 badge class:

```tsx
<span
  className={
    styles.status+' '+
    styles[
      getDisplayStatusClass(item)
    ]
  }
>
  {getDisplayStatus(item)}
</span>
```

CSS Module에서 하이픈 클래스 접근이 어렵다면 다음처럼 data 속성을 사용해도 됩니다.

```tsx
<span
  className={styles.status}
  data-display-status={
    getDisplayStatusClass(item)
  }
>
  {getDisplayStatus(item)}
</span>
```

## 6. 상단 요약 문구 통일

```tsx
<div>
  <span>방문 대기</span>
  <strong>{summary.waiting}</strong>
</div>

<div>
  <span>진행중</span>
  <strong>{summary.active}</strong>
</div>

<div>
  <span>검토대기</span>
  <strong>{summary.reviewPending}</strong>
</div>

<div>
  <span>반려·재방문</span>
  <strong>{summary.rejected}</strong>
</div>

<div>
  <span>최종 완료</span>
  <strong>{summary.done}</strong>
</div>
```

## 7. 버튼 문구

```ts
function reportActionLabel(item:Assignment){
  const display=getDisplayStatus(item);

  if(display==='검토대기'){
    return '제출 보고서 보기';
  }

  if(display==='반려'){
    return '작업보고 수정';
  }

  if(display==='재방문요청'){
    return '재방문 보고서 작성';
  }

  if(display==='승인완료'){
    return '작업보고 보기';
  }

  return nextActionLabel(item.status);
}
```

기존 버튼에서:

```tsx
{reportActionLabel(item)}
```

## 8. 반려 사유 표시

```tsx
{isReportRejected(item)&&
  item.report_rejection_reason&&(
    <p className={styles.rejectionReason}>
      관리자 요청: {item.report_rejection_reason}
    </p>
  )}
```
