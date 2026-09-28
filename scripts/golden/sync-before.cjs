// Resets the database to the "before" schema of the current scenario.
process.env.PHASE = 'before'
const dataSource = require('./data-source.cjs').default

dataSource
  .initialize()
  .then(async () => {
    await dataSource.dropDatabase()
    await dataSource.synchronize()
    await dataSource.destroy()
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
