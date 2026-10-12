import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { postgresSql } from '../app/database-sql.js';

export async function migrateSqlite(sourcePath, target, apply = false) {
  if (!existsSync(sourcePath)) throw new Error('Source database does not exist.');
  const source = new DatabaseSync(sourcePath, {readOnly:true});
  const allowed = ['Session','QuizConfig','QuizShopSetup','QuizReport','ScanUsage','ScanAppearance','GlobalSettings','OpenAICredentials','AICredentials','AISelection','QuizDefaults'];
  const tables = source.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all().filter(row=>allowed.includes(row.name));
  const summary = [];
  try {
    for (const table of tables) {
      const statement=source.prepare('SELECT * FROM "'+table.name+'"');statement.setReadBigInts(true);
      const rows=statement.all();
      summary.push({table:table.name,rows:rows.length});
      if (!apply) continue;
      await target.$executeRawUnsafe(postgresSql(table.sql.replace(/^CREATE TABLE (?:IF NOT EXISTS )?/i,'CREATE TABLE IF NOT EXISTS ')));
      for(const row of rows){
        const columns=Object.keys(row);
        const values=columns.map(column=>{
          const value=row[column];
          if(value==null) return null;
          if(table.name==='Session' && ['isOnline','accountOwner','collaborator','emailVerified'].includes(column)) return Boolean(value);
          if((table.name==='Session' && ['expires','refreshTokenExpires'].includes(column)) || (table.name==='QuizConfig' && column==='updatedAt')) return new Date(typeof value==='bigint'?Number(value):value);
          return value;
        });
        const names=columns.map(column=>'"'+column+'"');
        const targetName=['Session','QuizConfig','QuizShopSetup'].includes(table.name)?table.name:table.name.toLowerCase();
        await target.$executeRawUnsafe('INSERT INTO "'+targetName+'" ('+names.join(',')+') VALUES ('+values.map((_,i)=>'$'+(i+1)).join(',')+') ON CONFLICT DO NOTHING',...values);
      }
    }
    return summary;
  } finally {source.close();}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sourcePath=process.argv[2];
  if(!sourcePath) throw new Error('Usage: node scripts/migrate-sqlite-data.mjs SOURCE.sqlite [--apply]');
  const apply=process.argv.includes('--apply');
  if(!apply) console.log(await migrateSqlite(sourcePath,null,false));
  else {
    if(!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) throw new Error('A PostgreSQL target is required.');
    const {PrismaClient}=await import('@prisma/client');const target=new PrismaClient();
    try {console.log(await target.$transaction(tx=>migrateSqlite(sourcePath,tx,true),{timeout:120000}));}
    finally {await target.$disconnect();}
  }
}
