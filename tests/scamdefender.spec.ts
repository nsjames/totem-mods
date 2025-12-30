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

const scamdefender = blockchain.createContract('scamdefender', 'build/scamdefender',  true);
const miner = blockchain.createContract('miner', 'build/miner',  true);

describe('Mod', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
        await createAccount('user2')
        await createAccount('user3')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'scamdefender',
            [
                MOD_HOOKS.Transfer,
                MOD_HOOKS.Mint,
                MOD_HOOKS.Burn
            ],
            0,
            MOCK_MOD_DETAILS(false),
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
            '4,BLOCK',
            [
                { recipient: 'user', quantity: 1_000_000_000, label: 'user', is_minter: false },
                { recipient: 'user2', quantity: 1_000_000_000, label: 'user2', is_minter: false },
                { recipient: 'user3', quantity: 1_000_000_000, label: 'user3', is_minter: false },
                { recipient: 'miner', quantity: 1_000_000_000, label: 'miner', is_minter: true },
            ],
            totemMods({
                transfer: ['scamdefender'],
                mint: ['scamdefender', 'miner'],
                burn: ['scamdefender'],
            }),
        )

        assert(getTotemBalance('user', 'BLOCK') === 1_000_000_000, `Expected balance to be 1_000_000_000: user`);
        assert(getTotemBalance('user2', 'BLOCK') === 1_000_000_000, `Expected balance to be 1_000_000_000: user2`);
        assert(getTotemBalance('user3', 'BLOCK') === 1_000_000_000, `Expected balance to be 1_000_000_000: user3`);
    });
    it('should be able to send tokens freely from all users', async () => {
        await totems.actions.transfer(['user', 'user2', '1.0000 BLOCK', 'memo']).send('user');
        await totems.actions.transfer(['user2', 'user3', '1.0000 BLOCK', 'memo']).send('user2');
        await totems.actions.transfer(['user3', 'user', '1.0000 BLOCK', 'memo']).send('user3');
    });
    it('should be able to block a single account and not send to it or receive from it', async () => {
        // should NOT be able to block this from creator
        await expectToThrow(
            scamdefender.actions.block(['BLOCK', 'user2']).send('user'),
            "missing required authority scamdefender"
        );
        await scamdefender.actions.block(['BLOCK', 'user2']).send('scamdefender');

        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '1.0000 BLOCK', 'memo']).send('user'),
            "eosio_assert: blocked!"
        );

        await expectToThrow(
            totems.actions.transfer(['user2', 'user3', '1.0000 BLOCK', 'memo']).send('user2'),
            "eosio_assert: blocked!"
        );

        // other transfers should still work
        await totems.actions.transfer(['user3', 'user', '1.0000 BLOCK', 'memo']).send('user3');
    });
    it('should not be able to burn from a blocked account', async () => {
        await expectToThrow(
            totems.actions.burn(['user2', '1.0000 BLOCK', 'memo']).send('user2'),
            "eosio_assert: blocked!"
        );
    });
    it('should not be able to mint from a blocked account', async () => {
        await miner.actions.configure(['BLOCK', 10_0000, 100_0000]).send('creator');
        await expectToThrow(
            totems.actions.mint(['miner', 'user2', '0.0000 BLOCK', '0.0000 A', '']).send('user2'),
            "eosio_assert: blocked!"
        );
    });
    it('should be able to unblock the account and send/receive again', async () => {
        // should NOT be able to block this from creator
        await expectToThrow(
            scamdefender.actions.unblock(['BLOCK', 'user2']).send('user'),
            "missing required authority scamdefender"
        );
        await scamdefender.actions.unblock(['BLOCK', 'user2']).send('scamdefender');

        await totems.actions.transfer(['user', 'user2', '1.0000 BLOCK', 'memo']).send('user');
        await totems.actions.transfer(['user2', 'user3', '1.0000 BLOCK', 'memo']).send('user2');
    });
});
