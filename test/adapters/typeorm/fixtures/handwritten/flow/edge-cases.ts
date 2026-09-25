import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

declare const pairs: [string, string]
declare const options: { a: string; b: string }
declare const flag: boolean

const [FIRST_SQL, SECOND_SQL = 'SELECT 0', ...REST] = pairs
const { a: A_SQL, ...OTHER } = options
const LOOP_A: string = LOOP_B
const LOOP_B: string = LOOP_A
let assignedLater: string
assignedLater = 'SELECT 1'
export let notInitialized: string | undefined
export default function () {}

export class EdgeCases1727200000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner, ...rest: unknown[]): Promise<void> {
    type Local = string
    let pending: Local
    pending = 'SELECT 2'
    const rows = [['x']]
    const first = rows[0]
    await queryRunner.query(FIRST_SQL)
    await queryRunner.query(A_SQL)
    await queryRunner.query(LOOP_A)
    await queryRunner.query('')
    await queryRunner['query']('SELECT 3 AS computed_string_key')
    const method = flag ? 'dropTable' : 'clearTable'
    await queryRunner[method]('users')
    const getRunner = () => queryRunner
    items().map(function () {
      return queryRunner
    })
    const escaped = queryRunner.connection.driver.escape('users')
    await queryRunner.connection.query('SELECT 4')
    await queryRunner.connection.manager.query('SELECT 5')
    await queryRunner.addColumn('users', new TableColumn({ name: 'n', type: 'int', default: -1, isNullable: undefined }))
    await queryRunner.addColumn('users', new TableColumn())
    await queryRunner.query('SELECT ' + ('1' - '2'))
    class Inner {
      run() {
        return queryRunner.query('SELECT 6 AS inside_inner_class')
      }
    }
    switch (rows.length) {
      case 0:
        return
      default:
        break
    }
    await queryRunner.query('SELECT 7 AS after_switch_return')
  }

  public async down(): Promise<void> {}
}

declare function items(): unknown[]
