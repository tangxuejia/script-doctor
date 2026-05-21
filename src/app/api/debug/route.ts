import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization') || '(none)';
  const cookies = req.cookies.getAll().map(c => c.name);
  return NextResponse.json({ auth, cookies });
}
