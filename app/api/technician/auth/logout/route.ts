import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  hashSessionToken,
  technicianCookie,
} from '@/lib/technicianAuth';

export async function POST(req:NextRequest){
  try{
    const token=req.cookies.get(technicianCookie.name)?.value;

    if(token){
      const supabase=getSupabaseServer();

      await supabase
        .from('technician_sessions')
        .delete()
        .eq('token_hash',hashSessionToken(token));
    }

    const response=NextResponse.json({success:true});

    response.cookies.set(
      technicianCookie.name,
      '',
      {
        ...technicianCookie.options,
        maxAge:0,
      }
    );

    return response;
  }catch(e:any){
    const response=NextResponse.json(
      {error:e?.message||'기사 로그아웃 오류'},
      {status:500}
    );

    response.cookies.set(
      technicianCookie.name,
      '',
      {
        ...technicianCookie.options,
        maxAge:0,
      }
    );

    return response;
  }
}
