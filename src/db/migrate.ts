import fs from 'node:fs';
import path from 'node:path';
import { getPool } from './index';

async function migrate() {
  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  const pool = getPool();
  try {
    console.log('Running ReturnDesk database migration...');
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
