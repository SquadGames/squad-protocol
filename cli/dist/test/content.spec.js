"use strict";
/* global require module */
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const ethers_1 = require("ethers");
const lib_1 = require("@squad/lib");
const uniqueType = `testType-${ethers_1.ethers.Wallet.createRandom().address}`;
const data = ` { "type": "${uniqueType}", "underlyingWorks": [] }`;
const commonData = ' { "type": "common", "underlyingWorks": [] }';
async function wait(ms) {
    return new Promise((a, r) => {
        setTimeout(a, ms);
    });
}
describe('content', () => {
    let config;
    beforeAll(async () => {
        config = await (0, lib_1.getConfig)();
        const contents = [
            ['content1', 'metadata1', 10, 1, data, 'UTF8_STRING', 'UTF8_STRING'],
            ['content2', 'metadata1', 20, 2, data, 'UTF8_STRING', 'UTF8_STRING'],
            ['content3', 'metadata4', 30, 3, commonData, 'UTF8_STRING', 'UTF8_STRING']
        ];
        for (const i in contents) {
            const args = contents[i];
            if (args === undefined) {
                throw new Error('never');
            }
            const [content, metadata, sharePercentage, price, data, contentMedium, metadataMedium] = args;
            await (0, src_1.registerPurchasableContent)(content, metadata, sharePercentage, price, data, contentMedium, metadataMedium);
            await wait(200);
        }
    });
    test('returns content by type', async () => {
        var _a, _b;
        const got = await (0, src_1.content)({ type: uniqueType });
        const lines = got.split('\n');
        expect(lines.length).toBe(2);
        const line = lines[0];
        if (line === undefined) {
            throw new Error('never');
        }
        const [entityType, contentType, id, ...tags] = line.split(' ');
        expect(entityType).toBe('Content');
        expect(contentType).toBe(uniqueType);
        if (id === undefined) {
            expect(id).toBeDefined();
            throw 'narrow type scope, id was undefined';
        }
        expect((_a = id.split('-')[0]) !== null && _a !== void 0 ? _a : '').toBe(config.contracts.ERC721Squad.address.toLowerCase());
        expect(ethers_1.ethers.BigNumber.from((_b = id.split('-')[1]) !== null && _b !== void 0 ? _b : '').gte(0)).toBe(true);
    });
    test('returns content by nftAddress', async () => {
        const got = await (0, src_1.content)({
            nftAddress: config.contracts.ERC721Squad.address
        });
        const lines = got.split('\n');
        expect(lines.length).toBeGreaterThan(3);
        const line = lines[1];
        if (line === undefined) {
            throw new Error('never');
        }
        const [entityType, contentType, id, ...tags] = line.split(' ');
        if (id === undefined) {
            expect(id).toBeDefined();
            throw new Error('unexpected undefined id');
        }
        expect(id.split('-')[0]).toBe(config.contracts.ERC721Squad.address.toLowerCase());
    });
    test('returns content by id', async () => {
        const contentId = `${config.contracts.ERC721Squad.address.toLowerCase()}-0x1`;
        const got = await (0, src_1.content)({ id: contentId });
        expect(got.trim().includes('\n')).toBe(false);
        expect(got.split(' ')[2]).toBe(contentId);
    });
});
