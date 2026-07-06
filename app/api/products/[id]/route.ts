import { NextResponse } from 'next/server';
type Ctx={params:Promise<{id:string}>};
export async function PATCH(req:Request,ctx:Ctx){const {id}=await ctx.params;const body=await req.json();return NextResponse.json({ok:true,id,item:body});}
export async function DELETE(req:Request,ctx:Ctx){const {id}=await ctx.params;return NextResponse.json({ok:true,id});}
