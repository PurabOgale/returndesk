import { query, withTransaction } from '@/db';
import {
  assertRequestEditable,
  assertRequestRemovable,
  formatReturnReference,
  ReturnReason,
  ReturnResolution,
  ReturnStatus,
  validateTransitionRule,
} from './domain';
import { ApiError } from './errors';
import {
  CreateNoteInput,
  CreateRequestInput,
  ListRequestsQuery,
  SORTABLE_COLUMNS,
  UpdateRequestInput,
} from './validation';

export interface ReturnRequestDTO {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  orderNumber: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  reason: ReturnReason;
  status: ReturnStatus;
  resolution: ReturnResolution | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
  noteCount?: number;
}

export interface ReturnNoteDTO {
  id: string;
  requestId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ReturnRequestDetailDTO extends ReturnRequestDTO {
  notes: ReturnNoteDTO[];
}

interface DbRequestRow {
  id: string;
  reference: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  order_number: string;
  item_sku: string;
  item_name: string;
  quantity: number;
  reason: ReturnReason;
  status: ReturnStatus;
  resolution: ReturnResolution | null;
  refund_amount: string | null;
  removed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  note_count?: string;
}

interface DbNoteRow {
  id: string;
  request_id: string;
  author: string;
  body: string;
  created_at: Date;
}

function mapRequestRow(row: DbRequestRow): ReturnRequestDTO {
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    orderNumber: row.order_number,
    itemSku: row.item_sku,
    itemName: row.item_name,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution,
    refundAmount: row.refund_amount !== null ? Number(row.refund_amount) : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.note_count !== undefined ? { noteCount: Number(row.note_count) } : {}),
  };
}

function mapNoteRow(row: DbNoteRow): ReturnNoteDTO {
  return {
    id: row.id,
    requestId: row.request_id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listReturnRequests(params: ListRequestsQuery) {
  const conditions: string[] = ['r.removed_at IS NULL'];
  const values: unknown[] = [];

  if (params.status) {
    values.push(params.status);
    conditions.push(`r.status = $${values.length}`);
  }

  if (params.reason) {
    values.push(params.reason);
    conditions.push(`r.reason = $${values.length}`);
  }

  if (params.search) {
    values.push(`%${params.search}%`);
    const idx = values.length;
    conditions.push(
      `(r.reference ILIKE $${idx} OR r.customer_name ILIKE $${idx} OR COALESCE(r.customer_email, '') ILIKE $${idx} OR COALESCE(r.customer_phone, '') ILIKE $${idx} OR r.order_number ILIKE $${idx})`
    );
  }

  const whereClause = conditions.join(' AND ');
  const sortCol = SORTABLE_COLUMNS[params.sortBy];
  const sortDir = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM return_requests r WHERE ${whereClause}`,
    values
  );
  const totalItems = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);
  const totalPages = Math.max(1, Math.ceil(totalItems / params.pageSize));
  const offset = (params.page - 1) * params.pageSize;

  const listValues = [...values, params.pageSize, offset];
  const limitIdx = values.length + 1;
  const offsetIdx = values.length + 2;

  const rowsResult = await query<DbRequestRow>(
    `SELECT
       r.*,
       (SELECT COUNT(*)::text FROM return_notes n WHERE n.request_id = r.id) AS note_count
     FROM return_requests r
     WHERE ${whereClause}
     ORDER BY r.${sortCol} ${sortDir}, r.id ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listValues
  );

  return {
    items: rowsResult.rows.map(mapRequestRow),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getReturnRequestById(id: string): Promise<ReturnRequestDetailDTO> {
  const reqResult = await query<DbRequestRow>(
    `SELECT * FROM return_requests WHERE id = $1 AND removed_at IS NULL`,
    [id]
  );

  const row = reqResult.rows[0];
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Return request not found.');
  }

  const notesResult = await query<DbNoteRow>(
    `SELECT * FROM return_notes WHERE request_id = $1 ORDER BY created_at ASC, id ASC`,
    [id]
  );

  return {
    ...mapRequestRow(row),
    notes: notesResult.rows.map(mapNoteRow),
  };
}

export async function createReturnRequest(
  input: CreateRequestInput
): Promise<ReturnRequestDetailDTO> {
  return withTransaction(async (client) => {
    // Rule 3: One live request per order + item
    const existing = await client.query<{ id: string; reference: string; status: ReturnStatus }>(
      `SELECT id, reference, status
       FROM return_requests
       WHERE LOWER(TRIM(order_number)) = LOWER(TRIM($1))
         AND LOWER(TRIM(item_sku)) = LOWER(TRIM($2))
         AND status IN ('Open', 'In Review', 'Approved')
         AND removed_at IS NULL
       LIMIT 1`,
      [input.orderNumber, input.itemSku]
    );

    if (existing.rows.length > 0) {
      const dup = existing.rows[0];
      throw new ApiError(
        409,
        'DUPLICATE_LIVE_REQUEST',
        `A live return request (${dup.reference}, status: ${dup.status}) already exists for order '${input.orderNumber}' and item '${input.itemSku}'.`,
        {
          existingRequestId: dup.id,
          existingReference: dup.reference,
          existingStatus: dup.status,
        }
      );
    }

    const seqRes = await client.query<{ seq: string }>(
      `SELECT nextval('return_request_ref_seq')::text AS seq`
    );
    const reference = formatReturnReference(seqRes.rows[0].seq);

    const insertRes = await client.query<DbRequestRow>(
      `INSERT INTO return_requests (
         reference,
         customer_name,
         customer_email,
         customer_phone,
         order_number,
         item_sku,
         item_name,
         quantity,
         reason,
         status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Open')
       RETURNING *`,
      [
        reference,
        input.customerName,
        input.customerEmail,
        input.customerPhone,
        input.orderNumber,
        input.itemSku,
        input.itemName,
        input.quantity,
        input.reason,
      ]
    );

    return {
      ...mapRequestRow(insertRes.rows[0]),
      notes: [],
    };
  });
}

export async function updateReturnRequest(
  id: string,
  updates: UpdateRequestInput
): Promise<ReturnRequestDetailDTO> {
  return withTransaction(async (client) => {
    const currentRes = await client.query<DbRequestRow>(
      `SELECT * FROM return_requests WHERE id = $1 AND removed_at IS NULL FOR UPDATE`,
      [id]
    );
    const current = currentRes.rows[0];
    if (!current) {
      throw new ApiError(404, 'NOT_FOUND', 'Return request not found.');
    }

    // Rule 4: Locked once decided
    assertRequestEditable(current.status);

    const nextEmail =
      updates.customerEmail !== undefined ? updates.customerEmail : current.customer_email;
    const nextPhone =
      updates.customerPhone !== undefined ? updates.customerPhone : current.customer_phone;

    if (!nextEmail && !nextPhone) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'At least one contact method (email or phone) must remain on the request.'
      );
    }

    const nextOrder = updates.orderNumber ?? current.order_number;
    const nextSku = updates.itemSku ?? current.item_sku;

    // Rule 3: Check if updated order + item collides with another live request
    if (
      nextOrder.trim().toLowerCase() !== current.order_number.trim().toLowerCase() ||
      nextSku.trim().toLowerCase() !== current.item_sku.trim().toLowerCase()
    ) {
      const dupRes = await client.query<{ id: string; reference: string }>(
        `SELECT id, reference
         FROM return_requests
         WHERE id <> $1
           AND LOWER(TRIM(order_number)) = LOWER(TRIM($2))
           AND LOWER(TRIM(item_sku)) = LOWER(TRIM($3))
           AND status IN ('Open', 'In Review', 'Approved')
           AND removed_at IS NULL
         LIMIT 1`,
        [id, nextOrder, nextSku]
      );
      if (dupRes.rows.length > 0) {
        throw new ApiError(
          409,
          'DUPLICATE_LIVE_REQUEST',
          `Another live return request (${dupRes.rows[0].reference}) already exists for order '${nextOrder}' and item '${nextSku}'.`
        );
      }
    }

    const updatedRes = await client.query<DbRequestRow>(
      `UPDATE return_requests
       SET
         customer_name = $2,
         customer_email = $3,
         customer_phone = $4,
         order_number = $5,
         item_sku = $6,
         item_name = $7,
         quantity = $8,
         reason = $9,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        updates.customerName ?? current.customer_name,
        nextEmail,
        nextPhone,
        nextOrder,
        nextSku,
        updates.itemName ?? current.item_name,
        updates.quantity ?? current.quantity,
        updates.reason ?? current.reason,
      ]
    );

    const notesRes = await client.query<DbNoteRow>(
      `SELECT * FROM return_notes WHERE request_id = $1 ORDER BY created_at ASC, id ASC`,
      [id]
    );

    return {
      ...mapRequestRow(updatedRes.rows[0]),
      notes: notesRes.rows.map(mapNoteRow),
    };
  });
}

export async function transitionReturnRequest(
  id: string,
  params: {
    targetStatus: ReturnStatus;
    resolution: ReturnResolution | null;
    refundAmount: number | null;
  }
): Promise<ReturnRequestDetailDTO> {
  return withTransaction(async (client) => {
    const currentRes = await client.query<DbRequestRow>(
      `SELECT * FROM return_requests WHERE id = $1 AND removed_at IS NULL FOR UPDATE`,
      [id]
    );
    const current = currentRes.rows[0];
    if (!current) {
      throw new ApiError(404, 'NOT_FOUND', 'Return request not found.');
    }

    const { nextResolution, nextRefundAmount } = validateTransitionRule({
      currentStatus: current.status,
      targetStatus: params.targetStatus,
      resolution: params.resolution,
      refundAmount: params.refundAmount,
    });

    const finalResolution =
      params.targetStatus === 'Approved' ? nextResolution : current.resolution;
    const finalRefundAmount =
      params.targetStatus === 'Approved'
        ? nextRefundAmount
        : current.refund_amount !== null
        ? Number(current.refund_amount)
        : null;

    const updatedRes = await client.query<DbRequestRow>(
      `UPDATE return_requests
       SET
         status = $2,
         resolution = $3,
         refund_amount = $4,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, params.targetStatus, finalResolution, finalRefundAmount]
    );

    const notesRes = await client.query<DbNoteRow>(
      `SELECT * FROM return_notes WHERE request_id = $1 ORDER BY created_at ASC, id ASC`,
      [id]
    );

    return {
      ...mapRequestRow(updatedRes.rows[0]),
      notes: notesRes.rows.map(mapNoteRow),
    };
  });
}

export async function removeReturnRequest(id: string): Promise<{
  id: string;
  reference: string;
  removedAt: string;
}> {
  return withTransaction(async (client) => {
    const currentRes = await client.query<DbRequestRow>(
      `SELECT * FROM return_requests WHERE id = $1 AND removed_at IS NULL FOR UPDATE`,
      [id]
    );
    const current = currentRes.rows[0];
    if (!current) {
      throw new ApiError(404, 'NOT_FOUND', 'Return request not found.');
    }

    // Rule 5: Only Open or Rejected may be removed; record is never destroyed
    assertRequestRemovable(current.status);

    const removedRes = await client.query<{ removed_at: Date }>(
      `UPDATE return_requests
       SET removed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING removed_at`,
      [id]
    );

    return {
      id: current.id,
      reference: current.reference,
      removedAt: removedRes.rows[0].removed_at.toISOString(),
    };
  });
}

export async function addReturnNote(
  id: string,
  input: CreateNoteInput
): Promise<ReturnNoteDTO> {
  return withTransaction(async (client) => {
    const reqRes = await client.query<{ id: string }>(
      `SELECT id FROM return_requests WHERE id = $1 AND removed_at IS NULL`,
      [id]
    );
    if (reqRes.rows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Return request not found.');
    }

    const noteRes = await client.query<DbNoteRow>(
      `INSERT INTO return_notes (request_id, author, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, input.author, input.body]
    );

    await client.query(
      `UPDATE return_requests SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return mapNoteRow(noteRes.rows[0]);
  });
}
