/** JSON Schema for the "typeorm" key of the orm-preflight config. */
export const typeormConfigSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transactionMode: {
      enum: ['all', 'each', 'none'],
      default: 'all',
      description:
        'The transaction mode your migrations actually run with: the DataSource option migrationsTransactionMode, or the -t flag of "typeorm migration:run" when you pass one.',
    },
  },
} as const
