import "dotenv/config";
import { createWalletClient, createPublicClient, http, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import {
    getConfig as getNetworkConfig,
    getPublishConfig,
    listPublishConfigs,
    getChain,
    getRpcUrl,
    getPrivateKeyEnvVar,
} from '../deployments/configs/index.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Hardhat's default test account #0
const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

let hardhatNode: ChildProcess | null = null;

async function startHardhatNode(): Promise<void> {
    process.stdout.write('Starting hardhat node...');

    hardhatNode = spawn('npx', ['hardhat', 'node'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Hardhat node startup timeout'));
        }, 30000);

        hardhatNode!.stdout?.on('data', (data: Buffer) => {
            const output = data.toString();
            if (output.includes('Started HTTP')) {
                clearTimeout(timeout);
                console.log(' done');
                resolve();
            }
        });

        hardhatNode!.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        hardhatNode!.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                clearTimeout(timeout);
                reject(new Error(`Hardhat node exited with code ${code}`));
            }
        });
    });
}

function stopHardhatNode(): void {
    if (hardhatNode) {
        hardhatNode.kill();
        hardhatNode = null;
    }
}

function loadArtifact(contractName: string) {
    const artifactPath = path.join(
        import.meta.dirname,
        '..',
        'artifacts',
        'contracts',
        `${contractName}.sol`,
        `${contractName}.json`
    );

    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found: ${artifactPath}. Run 'npx hardhat compile' first.`);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
    return {
        abi: artifact.abi,
        bytecode: artifact.bytecode as `0x${string}`,
    };
}

// Load IMarket interface from @totems/evm package
function loadMarketAbi() {
    // Try to find the package
    const possiblePaths = [
        path.join(import.meta.dirname, '..', 'node_modules', '@totems', 'evm', 'artifacts', 'IMarket.json'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8')).abi;
        }
    }

    // Fallback: inline minimal ABI
    return [
        {
            name: 'publish',
            type: 'function',
            inputs: [
                { name: 'mod', type: 'address' },
                { name: 'hooks', type: 'uint8[]' },
                { name: 'price', type: 'uint256' },
                {
                    name: 'details',
                    type: 'tuple',
                    components: [
                        { name: 'name', type: 'string' },
                        { name: 'summary', type: 'string' },
                        { name: 'markdown', type: 'string' },
                        { name: 'image', type: 'string' },
                        { name: 'website', type: 'string' },
                        { name: 'websiteTickerPath', type: 'string' },
                        { name: 'isMinter', type: 'bool' },
                        { name: 'needsUnlimited', type: 'bool' },
                    ],
                },
                {
                    name: 'requiredActions',
                    type: 'tuple[]',
                    components: [
                        { name: 'signature', type: 'string' },
                        {
                            name: 'inputFields',
                            type: 'tuple[]',
                            components: [
                                { name: 'name', type: 'string' },
                                { name: 'mode', type: 'uint8' },
                                { name: 'value', type: 'string' },
                                { name: 'description', type: 'string' },
                                { name: 'min', type: 'uint256' },
                                { name: 'max', type: 'uint256' },
                                { name: 'isTotems', type: 'bool' },
                            ],
                        },
                        { name: 'cost', type: 'uint256' },
                        { name: 'reason', type: 'string' },
                    ],
                },
                { name: 'referrer', type: 'address' },
            ],
            outputs: [],
            stateMutability: 'payable',
        },
        {
            name: 'getMod',
            type: 'function',
            inputs: [{ name: 'mod', type: 'address' }],
            outputs: [
                {
                    name: '',
                    type: 'tuple',
                    components: [
                        { name: 'mod', type: 'address' },
                        { name: 'seller', type: 'address' },
                        { name: 'price', type: 'uint256' },
                        { name: 'sales', type: 'uint256' },
                        { name: 'hooks', type: 'uint8[]' },
                        { name: 'details', type: 'tuple', components: [] },
                        { name: 'requiredActions', type: 'tuple[]', components: [] },
                    ],
                },
            ],
            stateMutability: 'view',
        },
        {
            name: 'getFee',
            type: 'function',
            inputs: [{ name: 'referrer', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
        },
    ] as const;
}

interface DeployedAddresses {
    [key: string]: string;
}

function loadDeployedAddresses(network: string): DeployedAddresses {
    const addressesPath = path.join(import.meta.dirname, '..', 'deployments', 'addresses', `${network}.json`);
    if (fs.existsSync(addressesPath)) {
        return JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));
    }
    return {};
}

function saveDeployedAddresses(network: string, addresses: DeployedAddresses): void {
    const addressesDir = path.join(import.meta.dirname, '..', 'deployments', 'addresses');
    if (!fs.existsSync(addressesDir)) {
        fs.mkdirSync(addressesDir, { recursive: true });
    }
    const addressesPath = path.join(addressesDir, `${network}.json`);
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
}

async function publish(
    network: string,
    modNames: string[],
    options: { force?: boolean; verify?: boolean; deployOnly?: boolean } = {}
) {
    console.log(`\nPublishing to ${network}...`);
    console.log(`Mods: ${modNames.join(', ')}\n`);

    const chain = getChain(network);
    const networkConfig = getNetworkConfig(network);
    const rpcUrl = getRpcUrl(network);

    // Get private key
    const isHardhat = network === 'hardhat';
    let privateKey: `0x${string}`;

    if (isHardhat) {
        privateKey = HARDHAT_PRIVATE_KEY;
    } else {
        const envVar = getPrivateKeyEnvVar(network);
        const keyFromEnv = process.env[envVar]?.trim();
        if (!keyFromEnv) {
            throw new Error(`${envVar} not set in environment`);
        }
        privateKey = (keyFromEnv.startsWith('0x') ? keyFromEnv : `0x${keyFromEnv}`) as `0x${string}`;
    }

    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
    });

    console.log(`Deployer: ${account.address}`);

    // Load existing deployed addresses
    const deployedAddresses = loadDeployedAddresses(network);

    const marketAbi = loadMarketAbi();

    for (const modName of modNames) {
        console.log(`\n--- ${modName} ---`);

        // Load publish config
        let publishConfig;
        try {
            publishConfig = await getPublishConfig(modName);
        } catch (e: any) {
            console.log(`  Error: ${e.message}`);
            continue;
        }

        const contractName = publishConfig.contractName;
        let modAddress = deployedAddresses[contractName] as `0x${string}` | undefined;

        // Deploy contract if not already deployed (or force)
        if (!modAddress || options.force) {
            console.log(`  Deploying ${contractName}...`);

            const artifact = loadArtifact(contractName);

            const hash = await walletClient.deployContract({
                abi: artifact.abi,
                bytecode: artifact.bytecode,
                args: [networkConfig.totemsContract, networkConfig.deployer],
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            modAddress = receipt.contractAddress!;

            console.log(`  Deployed: ${modAddress}`);

            // Save address
            deployedAddresses[contractName] = modAddress;
            saveDeployedAddresses(network, deployedAddresses);

            // Wait for chain to index the contract
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            console.log(`  Already deployed: ${modAddress}`);
        }

        if (options.deployOnly) {
            continue;
        }

        // Check if already published
        try {
            const existingMod: any = await publicClient.readContract({
                address: networkConfig.marketContract,
                abi: marketAbi,
                functionName: 'getMod',
                args: [modAddress],
            });

            if (existingMod.mod !== ZERO_ADDRESS && !options.force) {
                console.log(`  Already published on market`);
                continue;
            }
        } catch (e: any) {
            // Not published yet or error reading
        }

        // Get publish fee
        const fee = await publicClient.readContract({
            address: networkConfig.marketContract,
            abi: marketAbi,
            functionName: 'getFee',
            args: [networkConfig.referrer],
        }) as bigint;

        console.log(`  Publishing to market (fee: ${fee})...`);

        // Publish
        const publishHash = await walletClient.writeContract({
            address: networkConfig.marketContract,
            abi: marketAbi,
            functionName: 'publish',
            args: [
                modAddress,
                publishConfig.hooks,
                publishConfig.price,
                publishConfig.details,
                publishConfig.requiredActions,
                networkConfig.referrer,
            ],
            value: fee,
        });

        await publicClient.waitForTransactionReceipt({ hash: publishHash });
        console.log(`  Published successfully`);

        // Verify if requested
        if (options.verify && !isHardhat) {
            console.log(`  Verifying...`);
            try {
                const hardhatNetwork = network === 'base-sepolia' ? 'baseSepolia' : network;
                const args = [
                    'hardhat', 'verify',
                    '--network', hardhatNetwork,
                    modAddress,
                    networkConfig.totemsContract,
                    networkConfig.deployer,
                ];

                await new Promise<void>((resolve) => {
                    const proc = spawn('npx', args, {
                        cwd: path.join(import.meta.dirname, '..'),
                        shell: true,
                    });

                    proc.on('close', () => resolve());
                });
                console.log(`  Verified`);
            } catch (e: any) {
                console.log(`  Verification failed: ${e.message}`);
            }
        }
    }

    console.log('\n--- Summary ---');
    console.log('Deployed addresses:');
    for (const [name, address] of Object.entries(deployedAddresses)) {
        console.log(`  ${name}: ${address}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const network = args.find(a => !a.startsWith('--'));
    const force = args.includes('--force');
    const verify = args.includes('--verify');
    const deployOnly = args.includes('--deploy-only');
    const all = args.includes('--all');

    if (!network) {
        console.error('Usage: bun scripts/publish.ts <network> [mod1] [mod2] ... [--all] [--force] [--verify] [--deploy-only]');
        console.error('');
        console.error('Options:');
        console.error('  --all          Publish all mods with publish configs');
        console.error('  --force        Re-deploy and re-publish even if already done');
        console.error('  --verify       Verify contracts on block explorer');
        console.error('  --deploy-only  Only deploy contracts, do not publish to market');
        console.error('');
        console.error('Networks: hardhat, base, base-sepolia');
        console.error('');
        console.error('Available mods:');
        for (const mod of listPublishConfigs()) {
            console.error(`  - ${mod}`);
        }
        process.exit(1);
    }

    // Get mod names
    let modNames = args.filter(a => !a.startsWith('--') && a !== network);

    if (all) {
        const networkConfig = getNetworkConfig(network);
        if (networkConfig.publish.length > 0) {
            modNames = networkConfig.publish;
        } else {
            modNames = listPublishConfigs();
        }
    }

    if (modNames.length === 0) {
        console.error('Error: No mods specified. Use --all or specify mod names.');
        console.error('Either add mods to the command line, use --all, or add a "publish" list to your network YAML config.');
        process.exit(1);
    }

    const isHardhat = network === 'hardhat';

    try {
        if (isHardhat) {
            await startHardhatNode();
        }

        await publish(network, modNames, { force, verify, deployOnly });
    } finally {
        if (isHardhat) {
            stopHardhatNode();
        }
    }
}

main().catch((err) => {
    stopHardhatNode();
    console.error('Publish failed:', err);
    process.exit(1);
});
