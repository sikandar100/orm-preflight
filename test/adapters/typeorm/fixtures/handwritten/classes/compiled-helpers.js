"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelperImport1727200000044 = void 0;
const tslib_1 = require("tslib");
let counter = 0;
counter = 1;
class Base {
}
class HelperImport1727200000044 extends Base {
    constructor() {
        super(...arguments);
        const ignored = 1;
        other.name = 'not this';
        this['name'] = 'HelperImport1727200000044';
        this.transaction = !0;
    }
    up(queryRunner) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield queryRunner.query(`SELECT 1 AS tslib_awaiter`);
        });
    }
}
exports.HelperImport1727200000044 = HelperImport1727200000044;
exports.Anonymous = class {
    async up(queryRunner) {
        await queryRunner.query('SELECT 2 AS anonymous_export');
    }
};
