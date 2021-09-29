#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.content = exports.registerPurchasableContent = exports.registerRevShareContent = exports.version = void 0;
const package_json_1 = __importDefault(require("../package.json"));
const client_js_1 = require("@web3api/client-js");
const ethereum_plugin_js_1 = require("@web3api/ethereum-plugin-js");
const ipfs_plugin_js_1 = require("@web3api/ipfs-plugin-js");
const ens_plugin_js_1 = require("@web3api/ens-plugin-js");
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@apollo/client");
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const lib_1 = require("@squad/lib");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
/*/ TODO move TxResponse interface from tests to lib
interface TxResponse {
  hash: string
  to?: string
  from: string
  nonce: number
  gasLimit: string
  gasPrice: string
  data: string
  value: string
  chainId: number
  blockNumber?: string
  blockHash?: string
  timestamp?: number
  confirmations: number
  raw?: string
  r?: string
  s?: string
  v?: number
  type?: number
  accessList?: Access[]
}

export interface Access {
  address: string
  storageKeys: string[]
} */
const apollo = new client_1.ApolloClient({
    link: new client_1.HttpLink({
        uri: 'http://localhost:8000/subgraphs/name/squadgames/squad-POC-subgraph',
        fetch: cross_fetch_1.default
    }),
    cache: new client_1.InMemoryCache()
});
// TODO don't default to localhost eth provider
const provider = new ethers_1.ethers.providers.JsonRpcProvider('http://localhost:8545');
async function getPolywrap(signer = 0) {
    // fetch providers from dev server
    const { data: { ipfs, ethereum } } = await axios_1.default.get('http://localhost:4040/providers');
    if (ipfs === undefined) {
        throw Error('Dev server must be running at port 4040');
    }
    const ensConfig = await axios_1.default.get('http://localhost:4040/ens');
    const ensAddress = ensConfig.data.ensAddress;
    return new client_js_1.Web3ApiClient({
        plugins: [
            {
                uri: '/ens/ens.web3api.eth',
                plugin: (0, ens_plugin_js_1.ensPlugin)({
                    addresses: {
                        testnet: ensAddress
                    }
                })
            },
            {
                uri: '/ens/ethereum.web3api.eth',
                plugin: (0, ethereum_plugin_js_1.ethereumPlugin)({
                    networks: {
                        testnet: {
                            provider: ethereum,
                            signer: signer
                        }
                    },
                    // If defaultNetwork is not specified, mainnet will be used.
                    defaultNetwork: 'testnet'
                })
            },
            {
                uri: '/ens/ipfs.web3api.eth',
                plugin: (0, ipfs_plugin_js_1.ipfsPlugin)({
                    provider: ipfs
                })
            }
        ]
    });
}
const squadUri = '/ens/testnet/squadprotocol.eth';
// TODO support standard wallet storage format
async function getWallet() {
    const secrets = await (0, lib_1.getSecrets)();
    const config = await (0, lib_1.getConfig)();
    if (secrets.cliPrivateKey === undefined) {
        console.error(`No private key found in ~/.squad/${config.network}-secrets.json.`);
        console.error('using new random key');
        return ethers_1.ethers.Wallet.createRandom();
    }
    return new ethers_1.ethers.Wallet(secrets.cliPrivateKey);
}
// TODO support data files in CLI
function getMedium(media) {
    var _a;
    try {
        new URL(media);
        return 'URI';
    }
    catch (_b) { }
    const ext = (_a = media.split('.').pop()) !== null && _a !== void 0 ? _a : '';
    if ([
        'json',
        'txt',
        'yaml',
        'yml',
        'toml',
        'ini'
    ].includes(ext)) {
        return 'UTF8_FILE';
    }
    throw new Error('Unsupported medium expected URI or json, txt, yaml, yml, toml, or ini file');
}
async function version() {
    return package_json_1.default.version;
}
exports.version = version;
async function registerRevShareContent() {
    throw new Error('Not Implemented');
}
exports.registerRevShareContent = registerRevShareContent;
function handleMedia(media, medium = 'auto', hash = 'auto') {
    if (medium === 'auto') {
        medium = getMedium(media);
    }
    if (medium === 'UTF8_FILE') {
        media = fs.readFileSync(media).toString();
        medium = 'UTF8_STRING';
    }
    if (medium === 'URI' && hash === 'auto') {
        throw new Error('URI medium, missing hash');
    }
    if (medium === 'UTF8_STRING' && hash === 'auto') {
        hash = ethers_1.ethers.utils.keccak256(Buffer.from(media));
    }
    return { media, medium, hash };
}
async function registerPurchasableContent(content, metadata, sharePercentage, price, data, contentMedium = 'auto', metadataMedium = 'auto', contentHash = 'auto', metadataHash = 'auto') {
    var _a, _b;
    try {
        const parsedData = JSON.parse(data);
        if (parsedData.type === undefined) {
            throw new Error('missing type field');
        }
        if (parsedData.underlyingWorks === undefined) {
            throw new Error('missing underlyingWorks');
        }
    }
    catch (e) {
        throw new Error(`invalid data: ${data} ${e}`);
    }
    const wallet = await getWallet();
    const config = await (0, lib_1.getConfig)();
    const _content = handleMedia(content, contentMedium, contentHash);
    const _metadata = handleMedia(metadata, metadataMedium, metadataHash);
    const query = (0, client_1.gql) `
          mutation registerPurchasableContent {
            registerPurchasableContent(
              creatorAddress: $creatorAddress
              licenseManagerAddress: $licenseManagerAddress
              content: $content
              contentMedium: $contentMedium
              contentHash: $contentHash
              metadata: $metadata
              metadataMedium: $metadataMedium
              metadataHash: $metadataHash
              registrant: $registrant
              sharePercentage: $sharePercentage
              price: $price
              data: $data
            )
          }`;
    const variables = {
        creatorAddress: wallet.address,
        licenseManagerAddress: config.contracts.PurchasableLicenseManager.address,
        registrant: wallet.address,
        sharePercentage: sharePercentage.toString(),
        price: price.toString(),
        data,
        content: _content.media,
        contentMedium: _content.medium,
        contentHash: _content.hash,
        metadata: _metadata.media,
        metadataMedium: _metadata.medium,
        metadataHash: _metadata.hash
    };
    const polywrap = await getPolywrap();
    const response = await polywrap.query({ uri: squadUri, query, variables });
    if (response.errors !== undefined) {
        throw new Error(response.errors.join('\n\n'));
    }
    // TODO make abis available in config
    const NFTRegisteredAbi = 'NFTRegistered(address,uint256,address,uint256,uint8,address,string)';
    const txHash = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.registerPurchasableContent.hash) !== null && _b !== void 0 ? _b : '';
    const tx = await provider.getTransaction(txHash);
    await tx.wait();
    const contract = new ethers_1.Contract(config.contracts.PurchasableLicenseManager.address, [`event ${NFTRegisteredAbi}`], provider);
    const filter = contract.filters.NFTRegistered();
    const rawLogs = await provider.getLogs(filter);
    const logs = rawLogs.map(l => contract.interface.parseLog(l));
    // TODO make register functions time independant (not dependant on latest logs)
    let latestMatch;
    for (const i in logs) {
        const log = logs[i];
        if (log === undefined) {
            throw new Error('never');
        }
        const [loggedNftAddress, loggedNftId, loggedRegistrant, loggedPrice, loggedSharePercentage, loggedLicenseTokenAddress, loggedData] = log.args;
        if (loggedData === data &&
            loggedRegistrant === wallet.address &&
            loggedPrice.eq(price) &&
            loggedSharePercentage === sharePercentage) {
            latestMatch = log.args;
        }
    }
    if (latestMatch === undefined || latestMatch.length !== 7) {
        throw new Error(`Failed to find log of registration, got ${latestMatch}`);
    }
    else {
        return latestMatch.join(' ');
    }
}
exports.registerPurchasableContent = registerPurchasableContent;
function displayContent(content) {
    return `${content.__typename} ${content.type} ${content.id}` +
        `${content.underlyingWorks.length > 0 ? ' derivative' : ''}` +
        `${content.revShareLicenses.length > 0 ? ' deriveable' : ''}` +
        `${content.purchasableLicenses.length > 0 ? ' purchasable' : ''}`;
}
async function content({ first = 100, skip = 0, _type, nftAddress, nftId, id }) {
    const query = (0, client_1.gql) `
    query Contents(
      $first: Int,
      $skip: Int,
      $type: String,
      $nftAddress: String,
      $id: String,
    ) {
      contents (
        first: $first
        skip: $skip
        where: {
          ${_type ? 'type: $type' : ''}
          ${nftAddress ? 'nftAddress: $nftAddress' : ''}
          ${id ? 'id: $id' : ''}
        }
      ) {
        id
        nftAddress
        nftId
        type
        underlyingWorks {
          id
        }
        purchasableLicenses {
   	  id
        }
        revShareLicenses {
          id
        }
      }
    }`;
    const response = await apollo.query({
        query: query,
        variables: { first, skip, type: _type, nftAddress, id }
    });
    return response.data.contents.map(displayContent).join('\n');
}
exports.content = content;
async function help() {
    return `help command not yet implemented, try one of ${Object.keys(commands)}`;
}
const commands = {
    version,
    "register-purchasable": registerPurchasableContent,
    content,
    help
};
