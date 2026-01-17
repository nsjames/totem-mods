import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const TOTEMS_EVM_PATH = path.join(import.meta.dirname, '..', '..', '..', 'totems-evm');
const CONFIGS_PATH = path.join(import.meta.dirname, '..', 'deployments', 'configs');

interface TotemsAddresses {
    chainId: number;
    referrer?: string;
    ModMarket: string;
    Totems: string;
    ProxyMod?: string;
    [key: string]: any;
}

function syncNetwork(network: string): boolean {
    const addressesPath = path.join(TOTEMS_EVM_PATH, 'deployments', 'addresses', `${network}.json`);
    const configPath = path.join(CONFIGS_PATH, `${network}.yaml`);

    // Check if source addresses exist
    if (!fs.existsSync(addressesPath)) {
        console.log(`  Skipping ${network}: no addresses file in totems-evm`);
        return false;
    }

    // Check if config exists
    if (!fs.existsSync(configPath)) {
        console.log(`  Skipping ${network}: no config file`);
        return false;
    }

    // Load addresses
    const addresses: TotemsAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));

    // Load and parse YAML
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(configContent) as Record<string, any>;

    // Track changes
    const changes: string[] = [];

    // Update totemsContract
    if (addresses.Totems && config.totemsContract !== addresses.Totems) {
        changes.push(`totemsContract: ${config.totemsContract || '(empty)'} → ${addresses.Totems}`);
        config.totemsContract = addresses.Totems;
    }

    // Update marketContract
    if (addresses.ModMarket && config.marketContract !== addresses.ModMarket) {
        changes.push(`marketContract: ${config.marketContract || '(empty)'} → ${addresses.ModMarket}`);
        config.marketContract = addresses.ModMarket;
    }

    // Update referrer if present
    if (addresses.referrer && config.referrer !== addresses.referrer) {
        changes.push(`referrer: ${config.referrer || '(empty)'} → ${addresses.referrer}`);
        config.referrer = addresses.referrer;
    }

    if (changes.length === 0) {
        console.log(`  ${network}: already up to date`);
        return false;
    }

    // Write updated config
    const newContent = yaml.dump(config, {
        quotingType: '"',
        forceQuotes: true,
        lineWidth: -1,
    });
    fs.writeFileSync(configPath, newContent);

    console.log(`  ${network}:`);
    for (const change of changes) {
        console.log(`    ${change}`);
    }

    return true;
}

function main() {
    const args = process.argv.slice(2);

    console.log('Syncing addresses from totems-evm...\n');

    // Check if totems-evm exists
    if (!fs.existsSync(TOTEMS_EVM_PATH)) {
        console.error(`Error: totems-evm not found at ${TOTEMS_EVM_PATH}`);
        process.exit(1);
    }

    // Get networks to sync
    let networks: string[];

    if (args.length > 0) {
        networks = args;
    } else {
        // Auto-detect from config files
        networks = fs.readdirSync(CONFIGS_PATH)
            .filter(f => f.endsWith('.yaml'))
            .map(f => f.replace('.yaml', ''));
    }

    let updated = 0;
    for (const network of networks) {
        if (syncNetwork(network)) {
            updated++;
        }
    }

    console.log(`\nDone. Updated ${updated} config(s).`);
}

main();
