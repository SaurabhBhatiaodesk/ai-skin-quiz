// Only SQL syntax changes here; values remain separate bound parameters.
export function postgresSql(sql) {
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\bDATETIME\b|\bINTEGER\b/g, token => {
    if (token === '?') return '$' + (++index);
    if (token === 'DATETIME') return 'TIMESTAMP(3)';
    // Millisecond timestamps exceed PostgreSQL's 32-bit INTEGER range.
    if (token === 'INTEGER') return 'BIGINT';
    return token;
  });
}
