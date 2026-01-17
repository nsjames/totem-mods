import { describe, it } from "node:test";
import assert from "node:assert";
import {expectToThrow, nameToBigInt} from "@vaulta/vert";
import {
    ACCOUNTS,
    blockchain,
    createAccount,
    createTotem,
    getTotemBalance,
    MOCK_MOD_DETAILS,
    MOD_HOOKS,
    publishMod,
    setup,
    totemMods, totems, vaulta
} from "./helpers";
import {TimePointSec} from "@wharfkit/antelope";

const whaleblock = blockchain.createContract('whaleblock', 'build/whaleblock',  true);
const miner = blockchain.createContract('miner', 'build/miner',  true);

describe('Whale Block', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
        await createAccount('user2')
        await createAccount('user3')
        await createAccount('user4')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'whaleblock',
            [
                MOD_HOOKS.Transfer,
            ],
            0,
            MOCK_MOD_DETAILS(true),
        )

        await publishMod(
            'seller',
            'miner',
            [
                MOD_HOOKS.Mint,
            ],
            0,
            MOCK_MOD_DETAILS(true),
        )

        await createTotem(
            '4,WHALE',
            [
                { recipient: 'user', quantity: 500_000, label: 'Totems', is_minter: false },
                { recipient: 'miner', quantity: 500_000, label: 'Mineable Totems', is_minter: true }
            ],
            totemMods({
                transfer: ['whaleblock'],
                mint: ['miner'],
            }),
        )
    });
    it('should be able to setup the whaleblock mod', async () => {
        await expectToThrow(
            whaleblock.actions.configure(['WHALE', 10, 0]).send('user'),
            "missing required authority creator"
        );
        await expectToThrow(
            whaleblock.actions.configure(['WHALE', 10, 10]).send('creator'),
            "eosio_assert: Cannot set both max_holdings_percent and max_totem_cap at the same time"
        );

        // 10% max
        await whaleblock.actions.configure(['WHALE', 10, 0]).send('creator');

        const configs = JSON.parse(JSON.stringify(await whaleblock.tables.totems(nameToBigInt('whaleblock')).getTableRows()));
        assert(configs.length === 1, `Expected 1 config, got ${configs.length}`);
        assert(configs[0].ticker === 'WHALE', `Expected ticker WHALE, got ${configs[0].ticker}`);
        assert(configs[0].max_holdings_percent === 10, `Expected max_holdings_percent 10, got ${configs[0].max_holdings_percent}`);
        assert(configs[0].max_totem_cap === 0, `Expected max_totem_cap 0, got ${configs[0].max_totem_cap}`);
    });
    it('should not be able to receive more than 10% of supply', async () => {
        // transfer 50,000 WHALE to user2 (5% of supply) - should succeed
        await totems.actions.transfer(['user', 'user2', '50000.0000 WHALE', '']).send('user');

        // transfer another 50,001 WHALE to user2 (would exceed 10% of supply) - should fail
        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '50000.0001 WHALE', '']).send('user'),
            "eosio_assert: No whales allowed."
        );
    });
    it('should remove all constraints and allow full transfer', async () => {
        // remove all constraints
        await whaleblock.actions.configure(['WHALE', 0, 0]).send('creator');

        // transfer another 50,001 WHALE to user2 - should succeed now
        await totems.actions.transfer(['user', 'user2', '50000.0001 WHALE', '']).send('user');

        const balance = getTotemBalance('user2', 'WHALE');
        assert(balance === 100_000.0001, `Expected balance to be 100_000.0001, got ${balance}`);
    });
    it('should set a hard cap on allowed balance', async () => {
        // set hard cap
        await whaleblock.actions.configure(['WHALE', 0, 10_0000]).send('creator');

        // transfer 19,999.9999 WHALE to user3 - should succeed
        await totems.actions.transfer(['user2', 'user3', '9.9999 WHALE', '']).send('user2');

        // transfer another 0.0002 WHALE to user3 - should fail (would exceed hard cap)
        await expectToThrow(
            totems.actions.transfer(['user2', 'user3', '0.0002 WHALE', '']).send('user2'),
            "eosio_assert: No whales allowed."
        );
    });
    it('should be able to mint/mine, but still not become a whale', async () => {
        await whaleblock.actions.configure(['WHALE', 10, 0]).send('creator');
        // need to set up miner mod
        // 50,000 totems per mine
        await miner.actions.configure(['WHALE', 50_000_0000, 0]).send('creator');

        // user4 should be able to mine 2 times
        await totems.actions.mint(['miner', 'user4', '0.0000 WHALE', '0.0000 A', '']).send('user4');
        await totems.actions.mint(['miner', 'user4', '0.0000 WHALE', '0.0000 A', '']).send('user4');

        await expectToThrow(
            totems.actions.mint(['miner', 'user4', '0.0000 WHALE', '0.0000 A', '']).send('user4'),
            "eosio_assert: No whales allowed."
        );
    })
});
