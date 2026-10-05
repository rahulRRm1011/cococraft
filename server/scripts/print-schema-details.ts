import fs from 'fs';
import path from 'path';

const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'schema-clean.json'), 'utf8'));

const out: string[] = [];
for (const t of schema) {
  out.push(`### Table: \`${t.name}\` (${t.rowCount} rows)`);
  out.push(`Original SQL:\n\`\`\`sql\n${t.sql}\n\`\`\`\n`);
  out.push(`Columns:`);
  for (const c of t.columns) {
    out.push(`- \`${c.name}\` (\`${c.type}\`)${c.pk ? ' **PRIMARY KEY**' : ''}${c.notnull ? ' NOT NULL' : ' NULL'}${c.dflt_value !== null ? ` DEFAULT \`${c.dflt_value}\`` : ''}`);
  }
  if (t.foreignKeys.length > 0) {
    out.push(`Foreign Keys:`);
    for (const fk of t.foreignKeys) {
      out.push(`- \`${fk.from}\` -> \`${fk.table}(${fk.to})\` ON DELETE ${fk.on_delete}`);
    }
  }
  const customIdx = t.indexes.filter((i: any) => !i.name.startsWith('sqlite_autoindex_'));
  if (customIdx.length > 0) {
    out.push(`Indexes:`);
    for (const idx of customIdx) {
      out.push(`- \`${idx.name}\` (${idx.columns.map((c: any) => `\`${c.name}\``).join(', ')})${idx.unique ? ' **UNIQUE**' : ''}`);
    }
  }
  out.push('\n---\n');
}
fs.writeFileSync(path.resolve(process.cwd(), 'scripts', 'schema-details.md'), out.join('\n'), 'utf8');
console.log('Successfully wrote schema-details.md');
