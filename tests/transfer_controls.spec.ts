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

const controls = blockchain.createContract('controls', 'build/controls',  true);

describe('Mod', () => {
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
            'controls',
            [
                MOD_HOOKS.Transfer,
            ],
            0,
            MOCK_MOD_DETAILS(false),
        )

        await createTotem(
            '4,CTRL',
            [{ recipient: 'user', quantity: 1_000_000_000, label: 'User', is_minter: false }],
            totemMods({
                transfer: ['controls'],
            }),
        )

        const balance = getTotemBalance('user', 'CTRL');
        assert(balance === 1_000_000_000, `Expected balance to be 1_000_000_000, got ${balance}`);
    });
    it('should be able to send freely before limits are set', async () => {
        await totems.actions.transfer(['user', 'user4', '500.0000 CTRL', 'memo']).send('user');
    });
    it('should be able to set global and per-account limits', async () => {
        blockchain.setTime(TimePointSec.fromMilliseconds(Date.now()));
        await controls.actions.limit(['user', 'CTRL', 1_0000, [
            // can exceed the global limit
            {recipient:'user2', daily_limit:2_0000},
            {recipient:'user3', daily_limit:5_0000}
        ]]).send('user');

        await expectToThrow(
            totems.actions.transfer(['user', 'user4', '100.0000 CTRL', 'memo']).send('user'),
            "eosio_assert: Transfer exceeds global daily limit"
        )

        await totems.actions.transfer(['user', 'user4', '1.0000 CTRL', 'memo']).send('user');
        await expectToThrow(
            totems.actions.transfer(['user', 'user4', '1.0000 CTRL', 'memo']).send('user'),
            "eosio_assert: Transfer exceeds global daily limit"
        )

        // should still be able to send to user2 and user3 within their limits
        await totems.actions.transfer(['user', 'user2', '2.0000 CTRL', 'memo']).send('user');
        await totems.actions.transfer(['user', 'user3', '5.0000 CTRL', 'memo']).send('user');

        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '1.0000 CTRL', 'memo']).send('user'),
            "eosio_assert: Transfer exceeds recipient daily limit"
        );
        await expectToThrow(
            totems.actions.transfer(['user', 'user3', '1.0000 CTRL', 'memo']).send('user'),
            "eosio_assert: Transfer exceeds recipient daily limit"
        );
    });
    it('should be able to transfer 24 hours later', async () => {
        // fast forward 24 hours
        blockchain.setTime(TimePointSec.fromMilliseconds(Date.now() + 25 * 60 * 60 * 1000));

        // should be able to send again
        await totems.actions.transfer(['user', 'user2', '2.0000 CTRL', 'memo']).send('user');

        // should not be able to send to user4 because per-account consumed the global limit
        await expectToThrow(
            totems.actions.transfer(['user', 'user4', '1.0000 CTRL', 'memo']).send('user'),
            "eosio_assert: Transfer exceeds global daily limit"
        );
    });
});
