import fs from 'node:fs';
import path from 'node:path';
import { getPool } from './index';
import {
  formatReturnReference,
  ReturnReason,
  ReturnResolution,
  ReturnStatus,
} from '../lib/domain';

interface SeedRequest {
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
  daysAgo: number;
  notes?: Array<{ author: string; body: string; hoursAfterCreate: number }>;
}

const SEED_REQUESTS: SeedRequest[] = [
  // Open (8)
  {
    customerName: 'Aarav Mehta',
    customerEmail: 'aarav.mehta@example.com',
    customerPhone: '+91-98201-44120',
    orderNumber: 'ORD-2026-1001',
    itemSku: 'SKU-CHAIR-PRO',
    itemName: 'ErgoMesh Office Chair',
    quantity: 1,
    reason: 'Damaged',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 1,
    notes: [
      {
        author: 'Priya S.',
        body: 'Customer reported cracked armrest upon unboxing. Requested photos via email.',
        hoursAfterCreate: 2,
      },
    ],
  },
  {
    customerName: 'Neha Kulkarni',
    customerEmail: 'neha.k@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1002',
    itemSku: 'SKU-LAMP-04',
    itemName: 'Minimalist Desk Lamp',
    quantity: 2,
    reason: 'Wrong Item',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 1,
  },
  {
    customerName: 'Rohan Deshmukh',
    customerEmail: null,
    customerPhone: '+91-97654-33210',
    orderNumber: 'ORD-2026-1003',
    itemSku: 'SKU-SHOE-42',
    itemName: 'CloudWalk Running Shoes (Size 42)',
    quantity: 1,
    reason: 'Size Issue',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 2,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Customer prefers exchange for Size 43 if stock is available.',
        hoursAfterCreate: 3,
      },
    ],
  },
  {
    customerName: 'Ananya Iyer',
    customerEmail: 'ananya.iyer@example.com',
    customerPhone: '+91-99001-11223',
    orderNumber: 'ORD-2026-1004',
    itemSku: 'SKU-MUG-SET',
    itemName: 'Ceramic Pour-Over Mug Set',
    quantity: 1,
    reason: 'Not As Described',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 2,
  },
  {
    customerName: 'Kabir Sharma',
    customerEmail: 'kabir.sharma@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1005',
    itemSku: 'SKU-MAT-02',
    itemName: 'Wool Felt Desk Mat',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 3,
  },
  {
    customerName: 'Sanya Kapoor',
    customerEmail: 'sanya.kapoor@example.com',
    customerPhone: '+91-98111-77889',
    orderNumber: 'ORD-2026-1006',
    itemSku: 'SKU-STAND-ALU',
    itemName: 'Aluminum Laptop Riser',
    quantity: 1,
    reason: 'Damaged',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 3,
    notes: [
      {
        author: 'Priya S.',
        body: 'Corner dent visible on packaging and hinge.',
        hoursAfterCreate: 4,
      },
    ],
  },
  {
    customerName: 'Devansh Joshi',
    customerEmail: 'devansh.j@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1007',
    itemSku: 'SKU-KB-MECH',
    itemName: 'Compact Mechanical Keyboard',
    quantity: 1,
    reason: 'Wrong Item',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 4,
  },
  {
    customerName: 'Meera Nair',
    customerEmail: 'meera.nair@example.com',
    customerPhone: '+91-94470-55661',
    orderNumber: 'ORD-2026-1008',
    itemSku: 'SKU-HOODIE-M',
    itemName: 'Heavyweight Cotton Hoodie (M)',
    quantity: 1,
    reason: 'Size Issue',
    status: 'Open',
    resolution: null,
    refundAmount: null,
    daysAgo: 4,
  },

  // In Review (7)
  {
    customerName: 'Siddharth Rao',
    customerEmail: 'sid.rao@example.com',
    customerPhone: '+91-98450-12345',
    orderNumber: 'ORD-2026-1009',
    itemSku: 'SKU-MON-ARM',
    itemName: 'Dual Gas-Spring Monitor Arm',
    quantity: 1,
    reason: 'Damaged',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 5,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Moved to In Review; awaiting warehouse inspection of tension bolt.',
        hoursAfterCreate: 6,
      },
      {
        author: 'Warehouse Ops',
        body: 'Photos confirmed hydraulic cylinder leak. Eligible for replacement or refund.',
        hoursAfterCreate: 20,
      },
    ],
  },
  {
    customerName: 'Ishita Verma',
    customerEmail: 'ishita.v@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1010',
    itemSku: 'SKU-BOTTLE-1L',
    itemName: 'Insulated Steel Bottle 1L',
    quantity: 3,
    reason: 'Not As Described',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 5,
    notes: [
      {
        author: 'Priya S.',
        body: 'Customer says matte navy looks closer to slate grey under indoor light.',
        hoursAfterCreate: 5,
      },
    ],
  },
  {
    customerName: 'Aditya Bansal',
    customerEmail: 'aditya.b@example.com',
    customerPhone: '+91-98990-65432',
    orderNumber: 'ORD-2026-1011',
    itemSku: 'SKU-PACK-24L',
    itemName: 'Commuter Backpack 24L',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 6,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Checking whether tags are intact for 14-day return window.',
        hoursAfterCreate: 8,
      },
    ],
  },
  {
    customerName: 'Pooja Malhotra',
    customerEmail: 'pooja.m@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1012',
    itemSku: 'SKU-JACKET-L',
    itemName: 'All-Weather Shell Jacket (L)',
    quantity: 1,
    reason: 'Size Issue',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 6,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Sleeves run short per customer. Checking XL inventory.',
        hoursAfterCreate: 10,
      },
    ],
  },
  {
    customerName: 'Karanvir Gill',
    customerEmail: null,
    customerPhone: '+91-98760-11220',
    orderNumber: 'ORD-2026-1013',
    itemSku: 'SKU-DOCK-USBC',
    itemName: 'USB-C 8-in-1 Hub',
    quantity: 1,
    reason: 'Wrong Item',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 7,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Received 5-in-1 hub instead of 8-in-1. Pick-list discrepancy logged.',
        hoursAfterCreate: 12,
      },
    ],
  },
  {
    customerName: 'Tanvi Saxena',
    customerEmail: 'tanvi.saxena@example.com',
    customerPhone: '+91-98220-90909',
    orderNumber: 'ORD-2026-1014',
    itemSku: 'SKU-PILLOW-MEM',
    itemName: 'Contour Memory Foam Pillow',
    quantity: 2,
    reason: 'Not As Described',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 7,
  },
  {
    customerName: 'Nikhil Chawla',
    customerEmail: 'nikhil.c@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1015',
    itemSku: 'SKU-MOUSE-WL',
    itemName: 'Vertical Ergonomic Mouse',
    quantity: 1,
    reason: 'Damaged',
    status: 'In Review',
    resolution: null,
    refundAmount: null,
    daysAgo: 8,
    notes: [
      {
        author: 'Priya S.',
        body: 'Scroll wheel unresponsive out of the box.',
        hoursAfterCreate: 4,
      },
    ],
  },

  // Approved (7)
  {
    customerName: 'Riya Chatterjee',
    customerEmail: 'riya.c@example.com',
    customerPhone: '+91-98300-44556',
    orderNumber: 'ORD-2026-1016',
    itemSku: 'SKU-CHAIR-PRO',
    itemName: 'ErgoMesh Office Chair',
    quantity: 1,
    reason: 'Damaged',
    status: 'Approved',
    resolution: 'Replacement',
    refundAmount: null,
    daysAgo: 9,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Verified transit damage on base caster.',
        hoursAfterCreate: 6,
      },
      {
        author: 'Vikram T.',
        body: 'Approved for immediate replacement unit dispatch.',
        hoursAfterCreate: 24,
      },
    ],
  },
  {
    customerName: 'Arjun Menon',
    customerEmail: 'arjun.menon@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1017',
    itemSku: 'SKU-HEADPHONE-NC',
    itemName: 'Studio ANC Headphones',
    quantity: 1,
    reason: 'Not As Described',
    status: 'Approved',
    resolution: 'Refund',
    refundAmount: 149.99,
    daysAgo: 9,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Approved full refund of $149.99 upon courier pickup scan.',
        hoursAfterCreate: 18,
      },
    ],
  },
  {
    customerName: 'Sneha Reddy',
    customerEmail: 'sneha.reddy@example.com',
    customerPhone: '+91-98490-22334',
    orderNumber: 'ORD-2026-1018',
    itemSku: 'SKU-TEE-PACK3',
    itemName: 'Organic Crewneck Tee (3-Pack)',
    quantity: 1,
    reason: 'Size Issue',
    status: 'Approved',
    resolution: 'Store Credit',
    refundAmount: null,
    daysAgo: 10,
    notes: [
      {
        author: 'Priya S.',
        body: 'Customer opted for Store Credit to pick a different bundle.',
        hoursAfterCreate: 14,
      },
    ],
  },
  {
    customerName: 'Varun Khanna',
    customerEmail: 'varun.khanna@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1019',
    itemSku: 'SKU-CABLE-TB4',
    itemName: 'Thunderbolt 4 Braided Cable',
    quantity: 2,
    reason: 'Wrong Item',
    status: 'Approved',
    resolution: 'Replacement',
    refundAmount: null,
    daysAgo: 10,
  },
  {
    customerName: 'Divya Krishnan',
    customerEmail: 'divya.k@example.com',
    customerPhone: '+91-98400-88776',
    orderNumber: 'ORD-2026-1020',
    itemSku: 'SKU-TOTE-CANVAS',
    itemName: 'Waxed Canvas Work Tote',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'Approved',
    resolution: 'Store Credit',
    refundAmount: null,
    daysAgo: 11,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Returned unused with tags. Approved for store credit.',
        hoursAfterCreate: 28,
      },
    ],
  },
  {
    customerName: 'Pranav Gokhale',
    customerEmail: 'pranav.g@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1021',
    itemSku: 'SKU-SCALE-DIG',
    itemName: 'Precision Coffee Scale',
    quantity: 1,
    reason: 'Damaged',
    status: 'Approved',
    resolution: 'Refund',
    refundAmount: 54.5,
    daysAgo: 11,
  },
  {
    customerName: 'Nandini Bose',
    customerEmail: 'nandini.b@example.com',
    customerPhone: '+91-98310-77665',
    orderNumber: 'ORD-2026-1022',
    itemSku: 'SKU-YOGA-MAT',
    itemName: 'Natural Cork Yoga Mat',
    quantity: 1,
    reason: 'Not As Described',
    status: 'Approved',
    resolution: 'Refund',
    refundAmount: 68.0,
    daysAgo: 12,
  },

  // Rejected (6)
  {
    customerName: 'Harsh Vardhan',
    customerEmail: 'harsh.v@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1023',
    itemSku: 'SKU-EARBUDS-PRO',
    itemName: 'Wireless Earbuds Pro',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'Rejected',
    resolution: null,
    refundAmount: null,
    daysAgo: 13,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Hygiene seal broken and item returned 42 days after delivery (outside 14-day window).',
        hoursAfterCreate: 16,
      },
    ],
  },
  {
    customerName: 'Kritika Sen',
    customerEmail: 'kritika.sen@example.com',
    customerPhone: '+91-98100-33445',
    orderNumber: 'ORD-2026-1024',
    itemSku: 'SKU-CASE-IPH',
    itemName: 'MagSafe Leather Case',
    quantity: 1,
    reason: 'Damaged',
    status: 'Rejected',
    resolution: null,
    refundAmount: null,
    daysAgo: 14,
    notes: [
      {
        author: 'Priya S.',
        body: 'Damage clearly caused by accidental drop after 3 weeks of use; not a transit defect.',
        hoursAfterCreate: 22,
      },
    ],
  },
  {
    customerName: 'Manish Tiwari',
    customerEmail: null,
    customerPhone: '+91-99110-44552',
    orderNumber: 'ORD-2026-1025',
    itemSku: 'SKU-SHIRT-OXF',
    itemName: 'Oxford Button-Down (L)',
    quantity: 1,
    reason: 'Size Issue',
    status: 'Rejected',
    resolution: null,
    refundAmount: null,
    daysAgo: 15,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Item was washed and altered; ineligible for return.',
        hoursAfterCreate: 12,
      },
    ],
  },
  {
    customerName: 'Shreya Hegde',
    customerEmail: 'shreya.h@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1026',
    itemSku: 'SKU-PEN-STYLUS',
    itemName: 'Capacitive Tablet Stylus',
    quantity: 1,
    reason: 'Wrong Item',
    status: 'Rejected',
    resolution: null,
    refundAmount: null,
    daysAgo: 16,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Serial number on returned stylus does not match order shipment log.',
        hoursAfterCreate: 19,
      },
    ],
  },
  {
    customerName: 'Gaurav Bhatia',
    customerEmail: 'gaurav.b@example.com',
    customerPhone: '+91-98180-55443',
    orderNumber: 'ORD-2026-1027',
    itemSku: 'SKU-TUMBLER-16',
    itemName: 'Travel Coffee Tumbler 16oz',
    quantity: 2,
    reason: 'Not As Described',
    status: 'Rejected',
    resolution: null,
    refundAmount: null,
    daysAgo: 17,
  },
  {
    customerName: 'Aishwarya Pillai',
    customerEmail: 'aishwarya.p@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1028',
    itemSku: 'SKU-CANDLE-SOY',
    itemName: 'Cedarwood Soy Candle',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'Rejected',
    resolution: null,
    refundAmount: null,
    daysAgo: 18,
    notes: [
      {
        author: 'Priya S.',
        body: 'Candle was partially burned before return request.',
        hoursAfterCreate: 9,
      },
    ],
  },

  // Completed (7)
  {
    customerName: 'Tushar Agarwal',
    customerEmail: 'tushar.a@example.com',
    customerPhone: '+91-98290-11224',
    orderNumber: 'ORD-2026-1029',
    itemSku: 'SKU-DESK-STAND',
    itemName: 'Standing Desk Converter',
    quantity: 1,
    reason: 'Damaged',
    status: 'Completed',
    resolution: 'Refund',
    refundAmount: 219.0,
    daysAgo: 20,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Approved full refund after warehouse confirmed bent frame.',
        hoursAfterCreate: 12,
      },
      {
        author: 'Finance Ops',
        body: 'Refund of $219.00 settled to original card.',
        hoursAfterCreate: 48,
      },
    ],
  },
  {
    customerName: 'Niharika Das',
    customerEmail: 'niharika.das@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1030',
    itemSku: 'SKU-SHOE-40',
    itemName: 'CloudWalk Running Shoes (Size 40)',
    quantity: 1,
    reason: 'Size Issue',
    status: 'Completed',
    resolution: 'Replacement',
    refundAmount: null,
    daysAgo: 21,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Replacement Size 41 delivered and signed for.',
        hoursAfterCreate: 72,
      },
    ],
  },
  {
    customerName: 'Omkar Patil',
    customerEmail: 'omkar.patil@example.com',
    customerPhone: '+91-98230-66778',
    orderNumber: 'ORD-2026-1031',
    itemSku: 'SKU-WALLET-SLIM',
    itemName: 'RFID Slim Card Wallet',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'Completed',
    resolution: 'Store Credit',
    refundAmount: null,
    daysAgo: 22,
    notes: [
      {
        author: 'Priya S.',
        body: 'Store credit voucher issued to customer account.',
        hoursAfterCreate: 30,
      },
    ],
  },
  {
    customerName: 'Bhavna Chauhan',
    customerEmail: 'bhavna.c@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1032',
    itemSku: 'SKU-KETTLE-GOOS',
    itemName: 'Gooseneck Electric Kettle',
    quantity: 1,
    reason: 'Wrong Item',
    status: 'Completed',
    resolution: 'Replacement',
    refundAmount: null,
    daysAgo: 24,
  },
  {
    customerName: 'Yashwant Rao',
    customerEmail: 'yashwant.rao@example.com',
    customerPhone: '+91-98451-99887',
    orderNumber: 'ORD-2026-1033',
    itemSku: 'SKU-THROW-LINEN',
    itemName: 'Belgian Linen Throw Blanket',
    quantity: 2,
    reason: 'Not As Described',
    status: 'Completed',
    resolution: 'Refund',
    refundAmount: 112.5,
    daysAgo: 25,
    notes: [
      {
        author: 'Anjali R.',
        body: 'Refund processed after return parcel cleared inspection.',
        hoursAfterCreate: 60,
      },
    ],
  },
  {
    customerName: 'Zoya Merchant',
    customerEmail: 'zoya.m@example.com',
    customerPhone: null,
    orderNumber: 'ORD-2026-1034',
    itemSku: 'SKU-WEBCAM-4K',
    itemName: '4K USB-C Streaming Webcam',
    quantity: 1,
    reason: 'Damaged',
    status: 'Completed',
    resolution: 'Refund',
    refundAmount: 129.99,
    daysAgo: 26,
  },
  {
    customerName: 'Vivek Sundaram',
    customerEmail: 'vivek.s@example.com',
    customerPhone: '+91-98401-33221',
    orderNumber: 'ORD-2026-1035',
    itemSku: 'SKU-SPEAKER-MINI',
    itemName: 'Portable Bluetooth Speaker',
    quantity: 1,
    reason: 'Changed Mind',
    status: 'Completed',
    resolution: 'Store Credit',
    refundAmount: null,
    daysAgo: 28,
    notes: [
      {
        author: 'Vikram T.',
        body: 'Closed out after issuing $75 store credit.',
        hoursAfterCreate: 36,
      },
    ],
  },
];

async function seed() {
  const pool = getPool();
  const shouldReset = process.argv.includes('--reset');

  try {
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);

    const existingCountRes = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM return_requests'
    );
    const existingCount = Number.parseInt(existingCountRes.rows[0].count, 10);

    if (existingCount > 0 && !shouldReset) {
      console.log(
        `Database already contains ${existingCount} return requests. Pass --reset to wipe and re-seed.`
      );
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (shouldReset) {
        await client.query('TRUNCATE TABLE return_notes, return_requests CASCADE');
        await client.query('ALTER SEQUENCE return_request_ref_seq RESTART WITH 1');
      }

      for (const item of SEED_REQUESTS) {
        const seqRes = await client.query<{ seq: string }>(
          `SELECT nextval('return_request_ref_seq')::text AS seq`
        );
        const reference = formatReturnReference(seqRes.rows[0].seq, 2026);
        const createdAt = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000);
        const updatedAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);

        const reqRes = await client.query<{ id: string }>(
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
             status,
             resolution,
             refund_amount,
             created_at,
             updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            reference,
            item.customerName,
            item.customerEmail,
            item.customerPhone,
            item.orderNumber,
            item.itemSku,
            item.itemName,
            item.quantity,
            item.reason,
            item.status,
            item.resolution,
            item.refundAmount,
            createdAt,
            updatedAt,
          ]
        );

        const requestId = reqRes.rows[0].id;
        if (item.notes && item.notes.length > 0) {
          for (const note of item.notes) {
            const noteCreatedAt = new Date(
              createdAt.getTime() + note.hoursAfterCreate * 60 * 60 * 1000
            );
            await client.query(
              `INSERT INTO return_notes (request_id, author, body, created_at)
               VALUES ($1, $2, $3, $4)`,
              [requestId, note.author, note.body, noteCreatedAt]
            );
          }
        }
      }

      await client.query('COMMIT');
      console.log(`Seeded ${SEED_REQUESTS.length} return requests with notes successfully.`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
