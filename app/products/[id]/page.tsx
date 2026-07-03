const products = [
  {
    id: 'cmc-a100',
    name: '코지마 CMC-A100',
    brand: '코지마',
    price: '상담 후 안내',
    grade: 'A급',
    description: '상태 확인 후 구매/판매/이전설치 상담이 가능한 중고 안마의자입니다.',
  },
  {
    id: 'bodyfriend-phantom',
    name: '바디프랜드 팬텀',
    brand: '바디프랜드',
    price: '상담 후 안내',
    grade: 'B급',
    description: '사진과 모델명을 남겨주시면 담당자가 빠르게 상담드립니다.',
  },
]

type ProductPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params
  const product = products.find((item) => item.id === id) ?? products[0]

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-5xl rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          ReChair 중고상품 상세
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex min-h-[320px] items-center justify-center rounded-[28px] bg-gradient-to-br from-slate-100 to-slate-200 text-6xl">
            🛋️
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">{product.brand}</p>
            <h1 className="mt-2 text-4xl font-black text-slate-950">{product.name}</h1>
            <p className="mt-4 text-lg text-slate-600">{product.description}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">상품 등급</p>
                <p className="text-2xl font-black text-slate-950">{product.grade}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">가격</p>
                <p className="text-2xl font-black text-slate-950">{product.price}</p>
              </div>
            </div>
            <a
              href="/#consultation"
              className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-lg font-black text-white shadow-lg shadow-blue-200"
            >
              이 상품 상담 신청
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
