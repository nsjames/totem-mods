import { parseEther, type Chain } from 'viem';
import { hardhat, base, baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Re-export types from @totems/evm for convenience
import {type ModActionFieldInputMode} from '@totems/evm/test/helpers';
export { ModActionFieldInputMode } from '@totems/evm/test/helpers';
export type { ModActionField, ModRequiredAction } from '@totems/evm/test/helpers';

// ==================== CHAIN CONFIG ====================

export function getChain(network: string): Chain {
    switch (network) {
        case 'hardhat':
            return hardhat;
        case 'base':
            return base;
        case 'base-sepolia':
        case 'baseSepolia':
            return baseSepolia;
        default:
            throw new Error(`Unknown network: ${network}. Valid: hardhat, base, base-sepolia`);
    }
}

export function getRpcUrl(network: string): string {
    const config = getConfig(network);
    if (config.rpcUrl) {
        return config.rpcUrl;
    }
    if (config.rpcEnvVar) {
        const url = process.env[config.rpcEnvVar]?.trim();
        if (!url) {
            throw new Error(`${config.rpcEnvVar} not set in environment`);
        }
        return url;
    }
    throw new Error(`No rpcUrl or rpcEnvVar specified in config for ${network}`);
}

export function getPrivateKeyEnvVar(network: string): string {
    const normalized = network.toUpperCase().replace(/[-\s]/g, '_');
    return `${normalized}_PRIVATE_KEY`;
}

// ==================== NETWORK CONFIG ====================

export interface NetworkConfig {
    deployer: `0x${string}`;
    rpcUrl?: string;
    rpcEnvVar?: string;
    explorerUrl?: string;
    explorerApiKeyEnvVar?: string;
    totemsContract: `0x${string}`;
    marketContract: `0x${string}`;
    referrer: `0x${string}`;
    referrerFee: bigint;
    publish: string[];
}

interface RawConfig {
    deployer: string;
    rpcUrl?: string;
    rpcEnvVar?: string;
    explorerUrl?: string;
    explorerApiKeyEnvVar?: string;
    totemsContract: string;
    marketContract: string;
    referrer: string;
    referrerFee: string;
    publish?: string[];
}

function parseValue(value: string): bigint {
    value = value.trim();
    if (value.endsWith(' ether')) {
        return parseEther(value.replace(' ether', ''));
    }
    if (value.endsWith(' gwei')) {
        return parseEther(value.replace(' gwei', '')) / 1_000_000_000n;
    }
    return BigInt(value);
}

function parseYaml(content: string): RawConfig {
    return yaml.load(content) as RawConfig;
}

function loadConfig(network: string): NetworkConfig {
    const configPath = path.join(import.meta.dirname, `${network}.yaml`);

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config not found: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const raw = parseYaml(content);

    return {
        deployer: raw.deployer as `0x${string}`,
        rpcUrl: raw.rpcUrl,
        rpcEnvVar: raw.rpcEnvVar,
        explorerUrl: raw.explorerUrl,
        explorerApiKeyEnvVar: raw.explorerApiKeyEnvVar,
        totemsContract: raw.totemsContract as `0x${string}`,
        marketContract: raw.marketContract as `0x${string}`,
        referrer: raw.referrer as `0x${string}`,
        referrerFee: parseValue(raw.referrerFee || '0'),
        publish: raw.publish || [],
    };
}

export function getConfig(network: string): NetworkConfig {
    return loadConfig(network);
}

export function listConfigs(): string[] {
    const configDir = import.meta.dirname;
    return fs.readdirSync(configDir)
        .filter(f => f.endsWith('.yaml'))
        .map(f => f.replace('.yaml', ''));
}

// ==================== HOOK ENUM ====================

export enum Hook {
    Created = 0,
    Mint = 1,
    Burn = 2,
    Transfer = 3,
    TransferOwnership = 4,
}

// ==================== PUBLISH CONFIG ====================

export interface ModDetails {
    name: string;
    summary: string;
    markdown: string;
    image: string;
    website: string;
    websiteTickerPath: string;
    isMinter: boolean;
    needsUnlimited: boolean;
}

export interface ModInputField {
    name: string;
    mode: ModActionFieldInputMode;
    value: string;
    description: string;
    min: bigint;
    max: bigint;
    isTotems: boolean;
}

export interface ModAction {
    signature: string;
    inputFields: ModInputField[];
    cost: bigint;
    reason: string;
}

export interface PublishConfig {
    contractName: string;
    hooks: Hook[];
    price: bigint;
    details: ModDetails;
    requiredActions: ModAction[];
}

// Alias for backwards compatibility
export type ParsedPublishConfig = PublishConfig;

// Cache for loaded configs
const publishConfigCache = new Map<string, PublishConfig>();

export async function getPublishConfig(modName: string): Promise<PublishConfig> {
    if (publishConfigCache.has(modName)) {
        return publishConfigCache.get(modName)!;
    }

    const publishDir = path.join(import.meta.dirname, '..', 'publish');
    const configPath = path.join(publishDir, `${modName}.ts`);

    if (!fs.existsSync(configPath)) {
        throw new Error(`Publish config not found: ${configPath}`);
    }

    // Dynamic import of the TypeScript config
    const module = await import(configPath);
    const config: PublishConfig = module.default;

    publishConfigCache.set(modName, config);
    return config;
}

export function listPublishConfigs(): string[] {
    const publishDir = path.join(import.meta.dirname, '..', 'publish');
    if (!fs.existsSync(publishDir)) {
        return [];
    }
    return fs.readdirSync(publishDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => f.replace('.ts', ''));
}
