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

const extinguisher = blockchain.createContract('extinguisher', 'build/extinguisher',  true);

describe('Extinguisher', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'extinguisher',
            [
                MOD_HOOKS.Burn,
            ],
            0,
            MOCK_MOD_DETAILS(true),
        )

        await createTotem(
            '4,NOBURN',
            [{ recipient: 'user', quantity: 1_000_000_000, label: 'Totems', is_minter: false }],
            totemMods({
                burn: ['extinguisher'],
            }),
        )
    });
    it('should not be able to burn totems', async () => {
        await expectToThrow(
            totems.actions.burn(['user', '1000.0000 NOBURN', 'memo']).send('user'),
            "eosio_assert: Totem burning is disabled by the extinguisher mod."
        );
    });
});
