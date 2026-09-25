import { Injectable } from '@nestjs/common'
import { MigrationInterface, QueryRunner } from 'typeorm'

function Tagged(tag: string): ClassDecorator {
  return () => undefined
}

@Injectable()
@Tagged('schema')
export class Decorated1727200000043 implements MigrationInterface {
  private readonly tables: ReadonlyArray<string> = ['users']

  public async up<T extends QueryRunner>(this: Decorated1727200000043, queryRunner: T): Promise<void> {
    await queryRunner.query<unknown[]>('SELECT 1 AS decorated')
  }

  public async down(): Promise<void> {}
}
