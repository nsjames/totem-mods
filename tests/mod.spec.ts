import { describe, it } from "node:test";
import assert from "node:assert";
import {expectToThrow} from "@vaulta/vert";
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
    totemMods, totems
} from "./helpers";

const mod = blockchain.createContract('mod', 'build/mod',  true);

describe('Mod', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'mod',
            [MOD_HOOKS.Burn],
            0
        )

        await createTotem(
            '4,TEST',
            [{ recipient: 'creator', quantity: 1000, label: 'Initial Supply', is_minter: false }],
            totemMods({
                burn: ['mod'],
            }),
        )

        const balance = getTotemBalance('creator', 'TEST');
        assert(balance === 1000, `Expected balance to be 1000, got ${balance}`);
    });
    it('should reject burns', async () => {
        await expectToThrow(
            totems.actions.burn(['creator', '1000.0000 TEST', 'memo']).send('creator'),
            "eosio_assert: reject burns"
        );
    });
    it('should NOT reject transfers', async () => {
        await totems.actions.transfer(['creator', ACCOUNTS.Tester, '1000.0000 TEST', 'memo']).send('creator');
    });
});
