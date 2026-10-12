import { spawnSync } from 'node:child_process';
const productionDatabase = /^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' && !productionDatabase && process.env.REQUIRE_PERSISTENT_DATABASE === '1') {
  throw new Error('Production requires a persistent PostgreSQL DATABASE_URL.');
}
const schema = productionDatabase ? 'prisma/production/schema.prisma' : 'prisma/schema.prisma';
const actions = process.argv.includes('--migrate') ? [['generate'], ['migrate', 'deploy']] : [['generate']];
for (const action of actions) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...action, '--schema', schema], {stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
