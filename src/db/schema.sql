-- ReturnDesk PostgreSQL Schema
-- Enforces data integrity, business rules, and server-side query performance at the database layer.

CREATE SEQUENCE IF NOT EXISTS return_request_ref_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(32) NOT NULL UNIQUE,
  customer_name VARCHAR(150) NOT NULL CHECK (LENGTH(TRIM(customer_name)) > 0),
  customer_email VARCHAR(255) NULL,
  customer_phone VARCHAR(50) NULL,
  order_number VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(order_number)) > 0),
  item_sku VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(item_sku)) > 0),
  item_name VARCHAR(200) NOT NULL CHECK (LENGTH(TRIM(item_name)) > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason VARCHAR(32) NOT NULL CHECK (
    reason IN ('Damaged', 'Wrong Item', 'Size Issue', 'Not As Described', 'Changed Mind')
  ),
  status VARCHAR(24) NOT NULL DEFAULT 'Open' CHECK (
    status IN ('Open', 'In Review', 'Approved', 'Rejected', 'Completed')
  ),
  resolution VARCHAR(24) NULL CHECK (
    resolution IN ('Refund', 'Replacement', 'Store Credit')
  ),
  refund_amount NUMERIC(10, 2) NULL,
  removed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- At least one contact method (email or phone) must be present
  CONSTRAINT chk_customer_contact CHECK (
    NULLIF(TRIM(COALESCE(customer_email, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(customer_phone, '')), '') IS NOT NULL
  ),

  -- Rule 2: Approval needs a resolution; non-approved/non-completed requests cannot have one
  CONSTRAINT chk_approval_resolution CHECK (
    (status IN ('Approved', 'Completed') AND resolution IS NOT NULL)
    OR (status NOT IN ('Approved', 'Completed') AND resolution IS NULL AND refund_amount IS NULL)
  ),

  -- Rule 2: Refund requires refund_amount > 0; non-Refund resolutions forbid refund_amount
  CONSTRAINT chk_refund_amount CHECK (
    (resolution = 'Refund' AND refund_amount IS NOT NULL AND refund_amount > 0)
    OR (resolution IS DISTINCT FROM 'Refund' AND refund_amount IS NULL)
  )
);

-- Rule 3: One live request per order + item (Open, In Review, Approved, and not removed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_live_request_per_order_item
  ON return_requests (LOWER(TRIM(order_number)), LOWER(TRIM(item_sku)))
  WHERE status IN ('Open', 'In Review', 'Approved') AND removed_at IS NULL;

-- Query indexes for server-side filtering, sorting, and pagination
CREATE INDEX IF NOT EXISTS idx_return_requests_active_status
  ON return_requests (status)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_return_requests_active_reason
  ON return_requests (reason)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_return_requests_active_created_at
  ON return_requests (created_at DESC)
  WHERE removed_at IS NULL;

-- Append-only notes table (never edited or deleted)
CREATE TABLE IF NOT EXISTS return_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE RESTRICT,
  author VARCHAR(100) NOT NULL DEFAULT 'Support Agent' CHECK (LENGTH(TRIM(author)) > 0),
  body TEXT NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_notes_request_created
  ON return_notes (request_id, created_at ASC, id ASC);
