import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toErrorResponse } from '@/lib/errors';
import {
  getReturnRequestById,
  removeReturnRequest,
  updateReturnRequest,
} from '@/lib/requests-service';
import { assertValidUuid, parseUpdateRequestInput } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const id = assertValidUuid(context.params.id);
    const detail = await getReturnRequestById(id);
    return NextResponse.json({ data: detail });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const id = assertValidUuid(context.params.id);
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }

    const updates = parseUpdateRequestInput(rawBody);
    const updated = await updateReturnRequest(id, updates);
    return NextResponse.json({ data: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const id = assertValidUuid(context.params.id);
    const removed = await removeReturnRequest(id);
    return NextResponse.json({ data: removed });
  } catch (err) {
    return toErrorResponse(err);
  }
}
