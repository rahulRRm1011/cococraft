import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'cococraft.db');
const db = new Database(dbPath);

interface TableInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string; sql: string }>;

console.log('=== COCOCRAFT SQLITE DATABASE INSPECTION ===\n');

for (const t of tables) {
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as { count: number };
  const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all() as TableInfo[];
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all() as ForeignKeyInfo[];
  const indexes = db.prepare(`PRAGMA index_list("${t.name}")`).all() as IndexInfo[];

  console.log(`----------------------------------------`);
  console.log(`TABLE: ${t.name} (Rows: ${countRow.count})`);
  console.log(`SQL: ${t.sql}`);
  console.log(`COLUMNS:`);
  for (const c of columns) {
    console.log(`  - ${c.name} [${c.type}] PK:${c.pk} NotNull:${c.notnull} Default:${c.dflt_value}`);
  }

  if (foreignKeys.length > 0) {
    console.log(`FOREIGN KEYS:`);
    for (const fk of foreignKeys) {
      console.log(`  - (${fk.from}) -> ${fk.table}(${fk.to}) ON DELETE ${fk.on_delete} ON UPDATE ${fk.on_update}`);
    }
  }

  if (indexes.length > 0) {
    console.log(`INDEXES:`);
    for (const idx of indexes) {
      const idxCols = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{ seqno: number; cid: number; name: string }>;
      console.log(`  - ${idx.name} (Unique: ${idx.unique}) on (${idxCols.map(ic => ic.name).join(', ')})`);
    }
  }
  console.log('');
}
