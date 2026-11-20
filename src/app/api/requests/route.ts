import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { createReturnRequest, listReturnRequests } from '@/lib/requests-service';
import { parseCreateRequestInput, parseListQueryParams } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = parseListQueryParams(request.nextUrl.searchParams);
    const result = await listReturnRequests(params);
    return NextResponse.json({
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }

    const input = parseCreateRequestInput(rawBody);
    const created = await createReturnRequest(input);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
