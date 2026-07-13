import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('products')
      .select('id,title,brand,model_name,price,thumbnail_url,is_visible')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상품 조회 오류' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseServer();

    const allowed = {
      title: body.title,
      brand: body.brand,
      model_name: body.model_name,
      price: body.price,
      grade: body.grade,
      status: body.status,
      year_text: body.year_text,
      region: body.region,
      warranty_text: body.warranty_text,
      description: body.description,
      stock_qty: body.stock_qty,
      is_visible: body.is_visible,
      is_featured: body.is_featured,
      thumbnail_url: body.thumbnail_url,
      photo_urls: body.photo_urls,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('products')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상품 수정 오류' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상품 삭제 오류' },
      { status: 500 }
    );
  }
}
