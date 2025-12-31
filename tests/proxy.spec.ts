import { describe, it } from "node:test";
import assert from "node:assert";
import {expectToThrow, nameToBigInt} from "@vaulta/vert";
import {
    ACCOUNTS,
    blockchain,
    createAccount,
    createTotem, eos,
    getTotemBalance,
    MOCK_MOD_DETAILS,
    MOD_HOOKS,
    publishMod,
    setup,
    totemMods, totems, vaulta
} from "./helpers";
import {TimePointSec} from "@wharfkit/antelope";

const proxy = blockchain.createContract('proxy', 'build/proxy',  true);
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
            1,
            MOCK_MOD_DETAILS(false),
        )
        await publishMod(
            'seller',
            'proxy',
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
            '4,PROXY',
            [
                { recipient: 'miner', quantity: 1_000_000_000, label: 'miner', is_minter: true },
            ],
            totemMods({
                transfer: ['proxy'],
                mint: ['proxy', 'miner'],
                burn: ['proxy'],
            }),
        )
    });
    it('should be able to mint tokens freely', async () => {
        await miner.actions.configure(['PROXY', 10_0000, 100_0000]).send('creator');
        await totems.actions.mint(['miner', 'user', '0.0000 PROXY', '0.0000 A', '']).send('user');
    });
    it('should be able to send tokens freely', async () => {
        await totems.actions.transfer(['user', 'user2', '1.0000 PROXY', 'memo']).send('user');
    });
    it('should be able to add the freezer mod using the proxy mod', async () => {
        // should not be able to add from non-creator
        await expectToThrow(
            proxy.actions.add(['PROXY', ['transfer'], 'freezer']).send('user'),
            "missing required authority creator"
        );
        // should require payment
        await expectToThrow(
            proxy.actions.add(['PROXY', ['transfer'], 'freezer']).send('creator'),
            "eosio_assert: No balance found for fee payment"
        );
        await eos.actions.transfer(['tester', 'proxy', '1.0000 EOS', 'fund proxy for fee']).send('tester');
        await proxy.actions.add(['PROXY', ['transfer'], 'freezer']).send('creator');
    });
    it('should be able to freeze the totem and disallow transfers', async () => {
        await freezer.actions.freeze(['PROXY']).send('creator');
        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '1.0000 PROXY', 'memo']).send('user'),
            "eosio_assert: frozen!"
        );
    });
    it('should be able to burn still while frozen since it only added to the transfer hook', async () => {
        await totems.actions.burn(['user', '1.0000 PROXY', 'memo']).send('user');
    });
    it('should add to the burn hook and fail to burn while frozen', async () => {
        await proxy.actions.add(['PROXY', ['burn'], 'freezer']).send('creator');
        await expectToThrow(
            totems.actions.burn(['user', '1.0000 PROXY', 'memo']).send('user'),
            "eosio_assert: frozen!"
        );
    });
    it('should be able to remove the burn hook and burn again', async () => {
        await proxy.actions.remove(['PROXY', 'burn', 'freezer']).send('creator');
        await totems.actions.burn(['user', '1.0000 PROXY', 'memo']).send('user');
    });
});
