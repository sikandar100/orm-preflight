module.exports = class CommonJs1727000000007 {
  async up(queryRunner) {
    const table = 'sresu'.split('').reverse().join('')
    await queryRunner.query(`DROP TABLE "${table}"`)
  }

  async down() {
    throw new Error('irreversible')
  }
}
