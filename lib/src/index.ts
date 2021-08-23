import * as fs from 'fs'
import * as path from 'path'
import { homedir } from 'os'

export interface Contract {
  address: string
  abiPath: string
}

export interface ContractInfo {
  [index: string]: Contract
}

export interface SquadProtocolConfig {
  network: string
  networkNameOrUrl: string
  contracts: ContractInfo
}

export interface SquadProtocolSecrets {
  deployPrivateKey: string
}

function getLatestConfigPath (): string {
  return process.env.SQUAD_CONFIG_PATH ??
    path.resolve(path.join('..', 'squad-config.json'))
}

export function getConfig (): any {
  return JSON.parse(fs.readFileSync(getLatestConfigPath()).toString())
}

export function writeConfig (config: SquadProtocolConfig, id = 'default'): void {
  if (id === 'default') {
    id = Date.now().toString()
  }
  const configFilename = `${config.network}-${id}.json`
  const configPath = path.resolve(
    path.join('..', 'config', configFilename)
  )
  const data = JSON.stringify(config)
  fs.writeFileSync(configPath, data)
  fs.writeFileSync(getLatestConfigPath(), data)
}

export function getSecrets (): any {
  const config = getConfig()
  const network: string = config.network ?? ''
  if (network === '') {
    throw new Error(
      '@squad/lib/getSecrets could not get secrets. Could not find network.'
    )
  }
  const secretsDir =
    process.env.SQUAD_SECRETS_DIR ?? path.join(homedir(), '.squad/')
  const secretsPath: string = path.join(secretsDir, `${network}-secrets.json`)
  if (!fs.existsSync(secretsPath)) {
    throw new Error(`Could not find secrets at ${secretsPath}`)
  }
  try {
    const secrets = JSON.parse(fs.readFileSync(secretsPath).toString())
    return secrets
  } catch (e) {
    console.error(e)
    throw new Error(`Could not parse secrets at ${secretsPath}`)
  }
}
