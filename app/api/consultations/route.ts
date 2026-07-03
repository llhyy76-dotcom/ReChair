import { NextResponse } from 'next/server';
export async function POST(req: Request){const body=await req.json(); console.log('consultation received', body); return NextResponse.json({ok:true, message:'received'});}
export async function GET(){return NextResponse.json({items:[]});}
