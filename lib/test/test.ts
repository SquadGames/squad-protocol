import * as lib from '../src'
import * as fs from 'fs'

function randInt (max: number): number {
  return Math.floor(Math.random() * max)
}

describe('MerkleTree', () => {
  // leaves, tree, root
  let cases: Array<[Buffer[], lib.MerkleTree, Buffer]>
  beforeEach(() => {
    cases = [...Array(200)].map((x) => {
      const leaves = [...Array(randInt(100) + 2)].map((i) => {
        return Buffer.from(Math.random().toString())
      })
      const tree = lib.makeMerkleTree(leaves)
      return [leaves, tree, lib.getRoot(tree)]
    })
  })

  test('It generates and validates proofs', () => {
    cases.forEach(([leaves, tree, root]) => {
      leaves.forEach((leaf) => {
        const proof = lib.getProof(tree, leaf)
        expect(lib.verify(proof, root, leaf)).toBe(true)
      })
    })
  })

  test('Root is 32 bytes', () => {
    cases.forEach(([leaves, tree, root]) => {
      const length = lib.getRoot(tree).length
      if (length !== 32) {
        console.log('leaves', leaves)
        console.log('tree', tree)
        console.log('root', root)
      }
      expect(lib.getRoot(tree).length).toBe(32)
    })
  })

  test('Generates expected root', () => {
    const leaves = [
      Buffer.from('a'),
      Buffer.from('b'),
      Buffer.from('c')
    ]
    const expectedRoot = lib.hashFn(
      Buffer.concat([
        lib.hashFn(Buffer.from('ab')),
        lib.hashFn(Buffer.from('cc'))
      ])
    )
    const tree = lib.makeMerkleTree(leaves)
    expect(lib.getRoot(tree)).toStrictEqual(expectedRoot)
  })
})

describe('Config', () => {
  test('getConfig returns a config object', () => {
    process.env.SQUAD_CONFIG_PATH = 'test/test-config.json'
    process.env.SQUAD_SECRETS_DIR = 'test'
    const config = lib.getConfig()
    expect(config.testConfigKey).toBe('testConfigValue')
  })

  test('getSecrets returns a network specific secrets object', () => {
    process.env.SQUAD_CONFIG_PATH = 'test/test-config.json'
    process.env.SQUAD_SECRETS_DIR = 'test'
    const secrets = lib.getSecrets()
    expect(secrets.mockSecretKey).toBe('mock-secret-value')
  })

  test('writeConfig writes config', () => {
    process.env.SQUAD_SECRETS_DIR = 'test'
    process.env.SQUAD_CONFIG_PATH = 'test/write-test-config.json'
    const value = Date.now().toString()
    const config = {
      writeTestKey: value,
      network: 'localhost',
      networkNameOrUrl: '',
      contracts: {}
    }

    lib.writeConfig(config, value)
    expect(lib.getConfig().writeTestKey).toBe(value)
    const localFile = `../config/localhost-${value}.json`
    expect(fs.existsSync(localFile)).toBe(true)
    fs.unlinkSync(localFile)
  })
})
