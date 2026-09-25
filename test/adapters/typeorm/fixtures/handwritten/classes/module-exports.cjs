const { TableColumn } = require('typeorm')

class ObjectExportA1727200000037 {
  async up(queryRunner) {
    await queryRunner.query('SELECT 1 AS object_export_a')
  }
  async down() {}
}

class ObjectExportB1727200000038 {
  async up(queryRunner) {
    await queryRunner.addColumn('users', new TableColumn({ name: 'b', type: 'int', isNullable: true }))
  }
  async down() {}
}

module.exports = { ObjectExportA1727200000037, ObjectExportB1727200000038 }
module.exports.PropertyExport1727200000039 = class PropertyExport1727200000039 {
  async up(queryRunner) {
    await queryRunner.query('SELECT 3 AS property_export')
  }
}
