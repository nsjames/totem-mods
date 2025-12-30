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

const wrapper = blockchain.createContract('wrapper', 'build/wrapper',  true);

describe('Mod', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'wrapper',
            [
                MOD_HOOKS.Transfer,
                MOD_HOOKS.Mint,
            ],
            0,
            MOCK_MOD_DETAILS(true),
        )

        await createTotem(
            '4,WA',
            [{ recipient: 'wrapper', quantity: 1_000_000_000, label: 'Wrappable Vaulta', is_minter: true }],
            totemMods({
                transfer: ['wrapper'],
                mint: ['wrapper'],
            }),
        )

        const balance = getTotemBalance('wrapper', 'WA');
        assert(balance === 1_000_000_000, `Expected balance to be 1_000_000_000, got ${balance}`);

        // need to set up mod
        await wrapper.actions.setup(['4,WA', '4,A', 'core.vaulta']).send('wrapper');
        // console.log(wrapper.tables.pairings(nameToBigInt('wrapper')).getTableRows())
        // process.exit(0);
    });
    it('should be able to wrap A tokens', async () => {
        await vaulta.actions.transfer(['user', 'wrapper', '1.0000 A', '']).send('user');
        // void mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const string& memo);
        await totems.actions.mint(['wrapper', 'user', '0.0000 WA', '0.0000 A', '4,A,core.vaulta']).send('user');

        {
            const balance = getTotemBalance('user', 'WA');
            assert(balance === 1, `Expected balance to be 1 WA, got ${balance}`);
        }
        {
            const balance = getTotemBalance('wrapper', 'WA');
            assert(balance === 999999999, `Expected balance to be 1 WA, got ${balance}`);
        }

        const balances = wrapper.tables.balances(nameToBigInt('wrapper')).getTableRows()[0];
        assert(balances.balance_wrappable === '1.0000 A', `Expected wrapper to hold 1.0000 A, got ${balances.balance}`);
        assert(balances.balance_totem === '999999999.0000 WA', `Expected wrapper to hold 0.0000 WA, got ${balances.balance}`);
    });
    it('should be able to unwrap A tokens', async () => {
        // transfer the wrapped A back to the mod
        await totems.actions.transfer(['user', 'wrapper', '1.0000 WA', '4,A,core.vaulta']).send('user');
        {
            const balance = getTotemBalance('user', 'WA');
            assert(balance === 0, `Expected balance to be 0 WA, got ${balance}`);
        }
        {
            const balance = getTotemBalance('wrapper', 'WA');
            assert(balance === 1_000_000_000, `Expected balance to be 1b WA, got ${balance}`);
        }
    });
});
