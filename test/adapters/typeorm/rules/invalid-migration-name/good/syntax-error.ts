export class Broken {
  async up(queryRunner) {
    await queryRunner.query('SELECT 1'
  }
}
