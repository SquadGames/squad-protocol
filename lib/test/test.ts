import * as lib from '../src'
import * as fs from 'fs'

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
