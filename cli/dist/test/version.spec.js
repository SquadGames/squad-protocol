"use strict";
/* global require module */
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
describe('version', () => {
    test('returns the current version', async () => {
        expect(await (0, src_1.version)()).toBe('0.0.1-dev');
    });
});
