import { NextResponse } from 'next/server';

export async function GET() {
  const serverTime = new Date().toISOString();
  return NextResponse.json({ serverTime });
} 