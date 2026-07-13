'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

type Product={id:string;title:string;brand:string;model_name:string;price:number;status:string;is_visible:boolean;is_featured:boolean};
const initial={title:'',brand:'',model_name:'',price:'',grade:'A급',status:'판매중',year_text:'',region:'',warranty_text:'',description:'',stock_qty:'1',is_visible:true,is_featured:false};

export default function AdminProducts(){
  const [products,setProducts]=useState<Product[]>([]);
  const [form,setForm]=useState(initial);
  const [photos,setPhotos]=useState<File[]>([]);
  const [previews,setPreviews]=useState<string[]>([]);
  const [message,setMessage]=useState('');

  const load=async()=>{const r=await fetch('/api/products');const j=await r.json();if(r.ok)setProducts(j.data||[])};
  useEffect(()=>{load()},[]);

  function choosePhotos(e:ChangeEvent<HTMLInputElement>){
    const list=Array.from(e.target.files||[]).slice(0,8);
    previews.forEach(URL.revokeObjectURL);
    setPhotos(list);setPreviews(list.map(URL.createObjectURL));
  }

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage('상품을 등록하는 중입니다...');
    let urls:string[]=[];
    if(photos.length){
      const fd=new FormData();photos.forEach(f=>fd.append('files',f));
      const ur=await fetch('/api/products/upload',{method:'POST',body:fd});const uj=await ur.json();
      if(!ur.ok){setMessage(uj?.error||'사진 업로드 실패');return}
      urls=uj.urls||[];
    }
    const r=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,price:Number(form.price||0),stock_qty:Number(form.stock_qty||1),thumbnail_url:urls[0]||null,photo_urls:urls})});
    const j=await r.json();if(!r.ok){setMessage(j?.error||'등록 실패');return}
    previews.forEach(URL.revokeObjectURL);setPreviews([]);setPhotos([]);setForm(initial);setMessage('상품이 정상 등록되었습니다.');load();
  }

  async function patch(id:string,body:Record<string,unknown>){await fetch(`/api/products/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});load()}
  async function remove(id:string){if(!confirm('이 상품을 삭제하시겠습니까?'))return;await fetch(`/api/products/${id}`,{method:'DELETE'});load()}

  return <div className="rc-admin-product-wrap">
    <section className="rc-admin-product-editor"><div className="rc-admin-product-title"><p>RECHAIR PRODUCT MANAGER</p><h1>판매상품 등록</h1></div>
    <form onSubmit={submit}><div className="rc-admin-product-fields">
      {[
        ['상품명','title'],['브랜드','brand'],['모델명','model_name'],['판매가격','price'],
        ['연식','year_text'],['판매지역','region'],['재고수량','stock_qty'],['AS 안내','warranty_text']
      ].map(([label,key])=><label key={key}><span>{label}</span><input required={['title','brand','model_name'].includes(key)} value={(form as any)[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
      <label><span>상품등급</span><select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option>A급</option><option>B급</option><option>리퍼</option></select></label>
      <label><span>판매상태</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>판매중</option><option>상담가능</option><option>예약중</option><option>판매완료</option></select></label>
      <label className="rc-admin-product-full"><span>상품 설명</span><textarea rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <div className="rc-admin-photo-box"><strong>상품 사진 업로드</strong><p>최대 8장까지 선택할 수 있습니다.</p><input type="file" accept="image/*" multiple onChange={choosePhotos}/>
        {previews.length>0&&<div className="rc-admin-photo-preview">{previews.map((u,i)=><img src={u} alt={`미리보기 ${i+1}`} key={u}/>)}</div>}
      </div>
    </div>
    <div className="rc-admin-product-options"><label><input type="checkbox" checked={form.is_visible} onChange={e=>setForm({...form,is_visible:e.target.checked})}/> 홈페이지 노출</label><label><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> 추천상품</label></div>
    <button className="rc-admin-product-submit">상품 등록</button>{message&&<p>{message}</p>}</form></section>
    <section className="rc-admin-product-list"><div className="rc-admin-product-title"><p>REGISTERED PRODUCTS</p><h2>등록 상품 관리</h2></div>
      {products.map(p=><article className="rc-admin-product-row" key={p.id}><div><strong>{p.title}</strong><small>{p.brand} · {p.model_name}</small></div><span>{Number(p.price).toLocaleString('ko-KR')}원</span><span>{p.status}</span>
      <div className="rc-admin-product-actions"><button onClick={()=>patch(p.id,{is_visible:!p.is_visible})}>{p.is_visible?'노출중':'숨김'}</button><button onClick={()=>patch(p.id,{is_featured:!p.is_featured})}>{p.is_featured?'추천중':'일반'}</button><button className="danger" onClick={()=>remove(p.id)}>삭제</button></div></article>)}
    </section>
  </div>
}
