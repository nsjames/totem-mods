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

const innercircle = blockchain.createContract('innercircle', 'build/innercircle',  true);
const miner = blockchain.createContract('miner', 'build/miner',  true);

describe('Mod', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('member')
        await createAccount('member2')
        await createAccount('anon')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'innercircle',
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
            '4,MEMBER',
            [
                { recipient: 'miner', quantity: 1_000_000_000, label: 'miner', is_minter: true },
            ],
            totemMods({
                transfer: ['innercircle'],
                mint: ['innercircle', 'miner'],
                burn: ['innercircle'],
            }),
        );
    });
    it('should not be able to mint unless a member', async () => {
        await miner.actions.configure(['MEMBER', 100_0000, 0]).send('creator');
        await expectToThrow(
            totems.actions.mint(['miner', 'member', '0.0000 MEMBER', '0.0000 A', '']).send('member'),
            "eosio_assert_message: member is not a member!"
        )
        // should not be able to sponsor members if not the creator or another member
        await expectToThrow(
            innercircle.actions.togglemember(['MEMBER', 'anon', 'member']).send('anon'),
            "eosio_assert_message: anon cannot sponsor membership!"
        )
        await innercircle.actions.togglemember(['MEMBER', 'creator', 'member']).send('creator');
        await totems.actions.mint(['miner', 'member', '0.0000 MEMBER', '0.0000 A', '']).send('member');
    });
    it('an existing member should be able to sponsor another member', async () => {
        await innercircle.actions.togglemember(['MEMBER', 'member', 'member2']).send('member');
        await totems.actions.mint(['miner', 'member2', '0.0000 MEMBER', '0.0000 A', '']).send('member2');
    });
    it('non members should not be able to be transferred to', async () => {
        await expectToThrow(
            totems.actions.transfer(['member', 'anon', '1.0000 MEMBER', 'memo']).send('member'),
            "eosio_assert_message: anon is not a member!"
        )
    });
    it('only creator can unmember an account', async () => {
        await expectToThrow(
            innercircle.actions.togglemember(['MEMBER', 'member', 'member2']).send('member'),
            "eosio_assert: Only the totem creator can remove members!"
        )
        await innercircle.actions.togglemember(['MEMBER', 'creator', 'member2']).send('creator');
        await expectToThrow(
            totems.actions.mint(['miner', 'member2', '0.0000 MEMBER', '0.0000 A', '']).send('member2'),
            "eosio_assert_message: member2 is not a member!"
        )
    });
});
