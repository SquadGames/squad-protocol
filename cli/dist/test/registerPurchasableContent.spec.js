"use strict";
/* global require module __dirname */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const path_1 = __importDefault(require("path"));
const ethers_1 = require("ethers");
const content = path_1.default.join(__dirname, 'test-content/content-a.json');
const price = 10;
const sharePercentage = 20;
const data = ' { "test-key": "test-value", "type": "registerTest", "underlyingWorks": [] }';
function isAddress(addr, log = false) {
    try {
        ethers_1.ethers.utils.getAddress(addr);
        return true;
    }
    catch (e) {
        if (log)
            console.error(e);
        return false;
    }
}
describe('registerPurchasableContent', () => {
    test('registers content', async () => {
        const got = await (0, src_1.registerPurchasableContent)(content, ' { "meta": true, "test": true }', sharePercentage, price, data, 'auto', 'UTF8_STRING');
        const [nftAddress, nftId, registrant, outPrice, outSharePercentage, licesnseTokenAddress, ...outData] = got.trim().split(' ');
        if (nftAddress === undefined) {
            expect(nftAddress).toBeDefined();
            throw new Error('unexpected undefined nftAddress');
        }
        expect(isAddress(nftAddress)).toBe(true);
        const parsedNftId = parseInt(nftId !== null && nftId !== void 0 ? nftId : '');
        expect(parsedNftId).toBeGreaterThan(-1);
        expect(parsedNftId).toBeLessThan(1000);
        if (registrant === undefined) {
            expect(registrant).toBeDefined();
            throw new Error('unexpected undefined registrant');
        }
        expect(isAddress(registrant)).toBe(true);
        expect(outPrice).toBe(price.toString());
        expect(outSharePercentage).toBe(sharePercentage.toString());
        expect(outData.join(' ')).toBe(data);
    });
});
