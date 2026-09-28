export const TENANT_TABLES = ['orders', 'invoices']

export function indexSql(table: string): string {
  return `CREATE INDEX "IDX_${table}_tenant" ON "${table}" ("tenantId")`
}
