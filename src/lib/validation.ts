import { ApiError } from './errors';
import {
  RETURN_REASONS,
  RETURN_RESOLUTIONS,
  RETURN_STATUSES,
  ReturnReason,
  ReturnResolution,
  ReturnStatus,
} from './domain';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertValidUuid(id: string): string {
  if (!UUID_REGEX.test(id)) {
    throw new ApiError(400, 'INVALID_ID', 'Request ID must be a valid UUID.');
  }
  return id;
}

function asTrimmedString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface CreateRequestInput {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  orderNumber: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  reason: ReturnReason;
}

export function parseCreateRequestInput(raw: unknown): CreateRequestInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  const body = raw as Record<string, unknown>;

  if ('reference' in body && body.reference !== undefined) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Reference is system-generated and cannot be provided by the client.'
    );
  }

  const fieldErrors: Record<string, string> = {};

  const customerName = asTrimmedString(body.customerName);
  if (!customerName) {
    fieldErrors.customerName = 'Customer name is required.';
  } else if (customerName.length > 150) {
    fieldErrors.customerName = 'Customer name must be 150 characters or fewer.';
  }

  const customerEmail = asTrimmedString(body.customerEmail);
  const customerPhone = asTrimmedString(body.customerPhone);

  if (!customerEmail && !customerPhone) {
    fieldErrors.customerContact =
      'At least one contact method (customerEmail or customerPhone) is required.';
  }
  if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
    fieldErrors.customerEmail = 'Customer email must be a valid email address.';
  }
  if (customerPhone && customerPhone.length > 50) {
    fieldErrors.customerPhone = 'Customer phone must be 50 characters or fewer.';
  }

  const orderNumber = asTrimmedString(body.orderNumber);
  if (!orderNumber) {
    fieldErrors.orderNumber = 'Order number is required.';
  } else if (orderNumber.length > 100) {
    fieldErrors.orderNumber = 'Order number must be 100 characters or fewer.';
  }

  const itemSku = asTrimmedString(body.itemSku);
  if (!itemSku) {
    fieldErrors.itemSku = 'Item SKU is required.';
  } else if (itemSku.length > 100) {
    fieldErrors.itemSku = 'Item SKU must be 100 characters or fewer.';
  }

  const itemName = asTrimmedString(body.itemName);
  if (!itemName) {
    fieldErrors.itemName = 'Item name is required.';
  } else if (itemName.length > 200) {
    fieldErrors.itemName = 'Item name must be 200 characters or fewer.';
  }

  const quantity = body.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    fieldErrors.quantity = 'Quantity must be a positive integer.';
  }

  const reason = body.reason;
  if (
    typeof reason !== 'string' ||
    !RETURN_REASONS.includes(reason as ReturnReason)
  ) {
    fieldErrors.reason = `Reason must be one of: ${RETURN_REASONS.join(', ')}.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid return request data.', {
      fieldErrors,
    });
  }

  return {
    customerName: customerName!,
    customerEmail,
    customerPhone,
    orderNumber: orderNumber!,
    itemSku: itemSku!,
    itemName: itemName!,
    quantity: quantity as number,
    reason: reason as ReturnReason,
  };
}

export interface UpdateRequestInput {
  customerName?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  orderNumber?: string;
  itemSku?: string;
  itemName?: string;
  quantity?: number;
  reason?: ReturnReason;
}

export function parseUpdateRequestInput(raw: unknown): UpdateRequestInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  const body = raw as Record<string, unknown>;
  const forbiddenFields = ['status', 'resolution', 'refundAmount', 'reference', 'removedAt'];
  for (const field of forbiddenFields) {
    if (field in body && body[field] !== undefined) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        `Field '${field}' cannot be modified through PATCH. Use the dedicated transition or removal endpoint.`
      );
    }
  }

  const updates: UpdateRequestInput = {};
  const fieldErrors: Record<string, string> = {};

  if ('customerName' in body) {
    const v = asTrimmedString(body.customerName);
    if (!v || v.length > 150) {
      fieldErrors.customerName = 'Customer name must be 1–150 characters.';
    } else {
      updates.customerName = v;
    }
  }

  if ('customerEmail' in body) {
    if (body.customerEmail === null || body.customerEmail === '') {
      updates.customerEmail = null;
    } else {
      const v = asTrimmedString(body.customerEmail);
      if (!v || !EMAIL_REGEX.test(v)) {
        fieldErrors.customerEmail = 'Customer email must be a valid email address.';
      } else {
        updates.customerEmail = v;
      }
    }
  }

  if ('customerPhone' in body) {
    if (body.customerPhone === null || body.customerPhone === '') {
      updates.customerPhone = null;
    } else {
      const v = asTrimmedString(body.customerPhone);
      if (!v || v.length > 50) {
        fieldErrors.customerPhone = 'Customer phone must be 1–50 characters.';
      } else {
        updates.customerPhone = v;
      }
    }
  }

  if ('orderNumber' in body) {
    const v = asTrimmedString(body.orderNumber);
    if (!v || v.length > 100) {
      fieldErrors.orderNumber = 'Order number must be 1–100 characters.';
    } else {
      updates.orderNumber = v;
    }
  }

  if ('itemSku' in body) {
    const v = asTrimmedString(body.itemSku);
    if (!v || v.length > 100) {
      fieldErrors.itemSku = 'Item SKU must be 1–100 characters.';
    } else {
      updates.itemSku = v;
    }
  }

  if ('itemName' in body) {
    const v = asTrimmedString(body.itemName);
    if (!v || v.length > 200) {
      fieldErrors.itemName = 'Item name must be 1–200 characters.';
    } else {
      updates.itemName = v;
    }
  }

  if ('quantity' in body) {
    const q = body.quantity;
    if (typeof q !== 'number' || !Number.isInteger(q) || q <= 0) {
      fieldErrors.quantity = 'Quantity must be a positive integer.';
    } else {
      updates.quantity = q;
    }
  }

  if ('reason' in body) {
    const r = body.reason;
    if (typeof r !== 'string' || !RETURN_REASONS.includes(r as ReturnReason)) {
      fieldErrors.reason = `Reason must be one of: ${RETURN_REASONS.join(', ')}.`;
    } else {
      updates.reason = r as ReturnReason;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid update fields.', {
      fieldErrors,
    });
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'At least one editable field must be provided.'
    );
  }

  return updates;
}

export interface TransitionInput {
  targetStatus: ReturnStatus;
  resolution: ReturnResolution | null;
  refundAmount: number | null;
}

export function parseTransitionInput(raw: unknown): TransitionInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  const body = raw as Record<string, unknown>;
  const targetStatus = body.targetStatus;

  if (
    typeof targetStatus !== 'string' ||
    !RETURN_STATUSES.includes(targetStatus as ReturnStatus)
  ) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      `targetStatus must be one of: ${RETURN_STATUSES.join(', ')}.`
    );
  }

  let resolution: ReturnResolution | null = null;
  if (body.resolution !== undefined && body.resolution !== null && body.resolution !== '') {
    if (
      typeof body.resolution !== 'string' ||
      !RETURN_RESOLUTIONS.includes(body.resolution as ReturnResolution)
    ) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        `resolution must be one of: ${RETURN_RESOLUTIONS.join(', ')}.`
      );
    }
    resolution = body.resolution as ReturnResolution;
  }

  let refundAmount: number | null = null;
  if (body.refundAmount !== undefined && body.refundAmount !== null && body.refundAmount !== '') {
    const num =
      typeof body.refundAmount === 'number'
        ? body.refundAmount
        : Number(body.refundAmount);
    if (!Number.isFinite(num)) {
      throw new ApiError(
        422,
        'INVALID_REFUND_AMOUNT',
        'refundAmount must be a valid finite number.'
      );
    }
    refundAmount = num;
  }

  return {
    targetStatus: targetStatus as ReturnStatus,
    resolution,
    refundAmount,
  };
}

export interface CreateNoteInput {
  author: string;
  body: string;
}

export function parseCreateNoteInput(raw: unknown): CreateNoteInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;
  const bodyText = asTrimmedString(obj.body);
  if (!bodyText) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Note body cannot be empty.');
  }

  const author = asTrimmedString(obj.author) ?? 'Support Agent';
  if (author.length > 100) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Author name must be 100 characters or fewer.'
    );
  }

  return { author, body: bodyText };
}

export const SORTABLE_COLUMNS = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  status: 'status',
  customer_name: 'customer_name',
  order_number: 'order_number',
  reference: 'reference',
} as const;

export type SortColumn = keyof typeof SORTABLE_COLUMNS;
export type SortOrder = 'asc' | 'desc';

export interface ListRequestsQuery {
  search: string;
  status: ReturnStatus | null;
  reason: ReturnReason | null;
  sortBy: SortColumn;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
}

export function parseListQueryParams(searchParams: URLSearchParams): ListRequestsQuery {
  const search = (searchParams.get('search') ?? '').trim();

  const statusParam = searchParams.get('status')?.trim() || null;
  if (statusParam && !RETURN_STATUSES.includes(statusParam as ReturnStatus)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Invalid status filter. Must be one of: ${RETURN_STATUSES.join(', ')}.`
    );
  }

  const reasonParam = searchParams.get('reason')?.trim() || null;
  if (reasonParam && !RETURN_REASONS.includes(reasonParam as ReturnReason)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Invalid reason filter. Must be one of: ${RETURN_REASONS.join(', ')}.`
    );
  }

  const sortByParam = (searchParams.get('sortBy') ?? 'created_at').trim();
  if (!(sortByParam in SORTABLE_COLUMNS)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Invalid sortBy column. Allowed: ${Object.keys(SORTABLE_COLUMNS).join(', ')}.`
    );
  }

  const sortOrderParam = (searchParams.get('sortOrder') ?? 'desc').trim().toLowerCase();
  if (sortOrderParam !== 'asc' && sortOrderParam !== 'desc') {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      "Invalid sortOrder. Must be 'asc' or 'desc'."
    );
  }

  const rawPage = searchParams.get('page') ?? '1';
  const page = Number.parseInt(rawPage, 10);
  if (!Number.isFinite(page) || page < 1) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'page must be a positive integer.');
  }

  const rawPageSize = searchParams.get('pageSize') ?? '10';
  const pageSize = Number.parseInt(rawPageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'pageSize must be an integer between 1 and 50.'
    );
  }

  return {
    search,
    status: statusParam as ReturnStatus | null,
    reason: reasonParam as ReturnReason | null,
    sortBy: sortByParam as SortColumn,
    sortOrder: sortOrderParam as SortOrder,
    page,
    pageSize,
  };
}
