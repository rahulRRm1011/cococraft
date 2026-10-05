import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'data', 'cococraft.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string; sql: string }>;

const output: any[] = [];

for (const t of tables) {
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as { count: number };
  const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all();
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all();
  const indexes = db.prepare(`PRAGMA index_list("${t.name}")`).all();
  
  const detailedIndexes = (indexes as any[]).map(idx => {
    const cols = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
    return { ...idx, columns: cols };
  });

  output.push({
    name: t.name,
    sql: t.sql,
    rowCount: countRow.count,
    columns,
    foreignKeys,
    indexes: detailedIndexes
  });
}

fs.writeFileSync(path.resolve(process.cwd(), 'scripts', 'schema-clean.json'), JSON.stringify(output, null, 2), 'utf8');
console.log(`Successfully wrote ${output.length} tables to scripts/schema-clean.json`);
