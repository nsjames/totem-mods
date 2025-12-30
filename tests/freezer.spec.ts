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

const freezer = blockchain.createContract('freezer', 'build/freezer',  true);
const miner = blockchain.createContract('miner', 'build/miner',  true);

describe('Mod', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
        await createAccount('user2')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'freezer',
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
            '4,FREEZE',
            [
                { recipient: 'user', quantity: 1_000_000_000, label: 'user', is_minter: false },
                { recipient: 'miner', quantity: 1_000_000_000, label: 'miner', is_minter: true },
            ],
            totemMods({
                transfer: ['freezer'],
                mint: ['freezer', 'miner'],
                burn: ['freezer'],
            }),
        )

        assert(getTotemBalance('user', 'FREEZE') === 1_000_000_000, `Expected balance to be 1_000_000_000: user`);
    });
    it('should be able to send tokens freely', async () => {
        await totems.actions.transfer(['user', 'user2', '1.0000 FREEZE', 'memo']).send('user');
    });
    it('should be able to FREEZE a single account and not send to it or receive from it', async () => {
        // should not be able to freeze from user
        await expectToThrow(
            freezer.actions.freeze(['FREEZE']).send('user'),
            "missing required authority creator"
        );
        await freezer.actions.freeze(['FREEZE']).send('creator');

        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '1.0000 FREEZE', 'memo']).send('user'),
            "eosio_assert: frozen!"
        );
    });
    it('should not be able to burn', async () => {
        await expectToThrow(
            totems.actions.burn(['user', '1.0000 FREEZE', 'memo']).send('user'),
            "eosio_assert: frozen!"
        );
    });
    it('should not be able to mint', async () => {
        await miner.actions.configure(['FREEZE', 10_0000, 100_0000]).send('creator');
        await expectToThrow(
            totems.actions.mint(['miner', 'user', '0.0000 FREEZE', '0.0000 A', '']).send('user'),
            "eosio_assert: frozen!"
        );
    });
    it('should be able to unfreeze', async () => {
        // should not be able to thaw from user
        await expectToThrow(
            freezer.actions.thaw(['FREEZE']).send('user'),
            "missing required authority creator"
        );
        await freezer.actions.thaw(['FREEZE']).send('creator');

        await totems.actions.transfer(['user', 'user2', '1.0000 FREEZE', 'memo']).send('user');
        await totems.actions.burn(['user', '1.0000 FREEZE', 'memo']).send('user');
        await totems.actions.mint(['miner', 'user', '0.0000 FREEZE', '0.0000 A', '']).send('user');
    });
});
