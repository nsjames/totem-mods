import {Blockchain, nameToBigInt, expectToThrow, symbolCodeToBigInt} from "@vaulta/vert";
import {Asset, Checksum256} from "@wharfkit/antelope";
// @ts-ignore
import chai, { assert } from "chai";
chai.config.truncateThreshold = 0;

export const blockchain = new Blockchain();

export const eos = blockchain.createContract('eosio.token', 'prebuilts/eosio.token', true);
export const vaulta = blockchain.createContract('core.vaulta', 'prebuilts/core.vaulta',  true,{privileged: true});
export const totems = blockchain.createContract('totemstotems', 'prebuilts/totems', true);
export const market = blockchain.createContract('modsmodsmods', 'prebuilts/market',  true);
export const ACCOUNTS = {
    Tester: 'tester',
    Fees: 'eosio.fees',
}
blockchain.createAccounts(...Object.values(ACCOUNTS));

export const resetBlockchainTable = async (table: any) => {
    blockchain.resetTables(table);
}

export const setup = async () => {
    await eos.actions.create(['tester', '1000000000.0000 EOS']).send('eosio.token');
    await eos.actions.issue(['tester', '1000000000.0000 EOS', 'initial supply']).send('tester');

    await vaulta.actions.init(['1000000000.0000 A']).send('core.vaulta');
    await eos.actions.transfer(['tester', 'core.vaulta', '500000000.0000 EOS', '']).send('tester');

    for(const account of Object.values(ACCOUNTS).concat([totems.name.toString(), market.name.toString()])) {
        await vaulta.actions.open([account, '4,A', account]).send(account);
        await eos.actions.open([account, '4,EOS', account]).send(account);
    }
}

export const createAccount = async (name:string, tokens = 100_000) => {
    blockchain.createAccount(name);
    await vaulta.actions.open([name, '4,A', name]).send(name);
    await eos.actions.open([name, '4,EOS', name]).send(name);
    await transfer('tester', name, `${parseFloat(tokens.toString()).toFixed(4)} A`, 'initial balance');
    await transfer('tester', name, `${parseFloat(tokens.toString()).toFixed(4)} EOS`, 'initial balance');
}

export const transfer = (from, to, quantity, memo = '') => {
    const _contract = quantity.includes('EOS') ? eos : quantity.includes('A') ? vaulta : totems;
    return _contract.actions.transfer([from, to, quantity, memo]).send(from);
}

export const getBalance = (account, _contract) => {
    const table = _contract.tables.accounts(nameToBigInt(account));
    const rows = table.getTableRows();
    return rows.length ? parseFloat(rows[0].balance.split(' ')[0]) : 0;
}

export const getTotemBalance = (account, ticker) => {
    const table = totems.tables.accounts(nameToBigInt(account));
    const rows = table.getTableRows();
    for (const row of rows) {
        if (row.balance.includes(ticker)) {
            return parseFloat(row.balance.split(' ')[0]);
        }
    }
    return 0;
}

export interface ModDetails {
    name: string;
    summary: string;
    markdown: string;
    website: string;
    website_token_path: string;
    image: string;
}

export const publishMod = async (
    seller:string,
    contract:string,
    hooks:string[],
    price:number,
    details:ModDetails = MOCK_MOD_DETAILS(),
    authorizer = 'seller',
    referrer = undefined,
    required_actions = undefined
) => {
    await transfer('tester', market.name.toString(), '100.0000 A', 'fund market account');
    return market.actions.publish([
        seller,
        contract,
        hooks,
        price,
        details,
        required_actions || [],
        referrer
    ]).send(authorizer);
}


export const totemMods = (obj:any = {}) => Object.assign({
    transfer:[],
    mint:[],
    burn:[],
    open:[],
    close:[],
    created:[]
}, obj);

export interface Allocation {
    label: string;
    recipient: string;
    quantity: number;
    is_minter: boolean;
}

export const createTotem = async (
    symbol,
    allocations:Allocation[],
    mods = totemMods(),
    authorizer = 'creator',
    details = MOCK_TOTEM_DETAILS(),
    referrer = undefined
) => {
    await transfer('tester', totems.name.toString(), '100.0000 A', 'fund totems account');
    return totems.actions.create([
        'creator',
        symbol,
        allocations.map(alloc => ({
            label: alloc.label,
            recipient: alloc.recipient,
            quantity: `${alloc.quantity.toFixed(parseInt(symbol.split(',')[0]))} ${symbol.split(',')[1]}`,
            is_minter: alloc.is_minter
        })),
        mods,
        details,
        referrer
    ]).send(authorizer)
}

export const MOD_HOOKS = {
    Transfer: 'transfer',
    Mint: 'mint',
    Burn: 'burn',
    Open: 'open',
    Close: 'close',
    Created: 'created'
}

export const MOCK_MOD_DETAILS = (is_minter:boolean = false) => ({
    name: "A cool new mod!",
    summary: "This is a summary of a cool new mod.",
    markdown: "## Features\n\n- Feature 1\n- Feature 2\n- Feature 3",
    website: "https://mods.example.com",
    website_token_path: "/mods/{token_id}",
    image: "ipfs://QmModImageHash",
    is_minter
});

export const MOCK_TOTEM_DETAILS = () => ({
    name: "A cool new totem!",
    image: "ipfs://QmTotemImageHash",
    seed: Checksum256.hash('1110762033e7a10db4502359a19a61eb81312834769b8419047a2c9ae03ee847'),
    description: "This totem is really cool because...",
    website: "https://totems.example.com",
});
