import { describe, it } from "node:test";
import assert from "node:assert";
import {expectToThrow, nameToBigInt, symbolCodeToBigInt} from "@vaulta/vert";
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
import {Asset, TimePointSec} from "@wharfkit/antelope";
import SymbolCode = Asset.SymbolCode;

const allowances = blockchain.createContract('allowances', 'build/allowances',  true);

const getAllowance = async (owner: string, spender: string) => {
    return parseFloat(JSON.parse(JSON.stringify(
        (await allowances.actions.getallowance([owner, spender, '4,ALLOW']).send())[0].returnValue)
    ).split(' ')[0])
}

const getEscrowBalance = async (account: string) => {
    return parseFloat(JSON.parse(JSON.stringify(
        (await allowances.actions.getbalance([account, '4,ALLOW']).send())[0].returnValue)
    ).split(' ')[0])
}

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
            'allowances',
            [
                MOD_HOOKS.Transfer,
            ],
            0,
            MOCK_MOD_DETAILS(false),
        )

        await createTotem(
            '4,ALLOW',
            [{ recipient: 'user', quantity: 1_000_000, label: 'User', is_minter: false }],
            totemMods({
                transfer: ['allowances'],
            }),
        )

    });
    it('should be able to transfer normally', async () => {
        await totems.actions.transfer(['user', 'user2', '1.0000 ALLOW', 'memo']).send('user');
    });
    it('should be able to set allowances', async () => {

        // can set an allowance that's even greater than their balance
        await allowances.actions.approve(['user', 'user2', '2000000.0000 ALLOW']).send('user');
        assert(await getAllowance('user', 'user2') === 2000000, 'Expected allowance to be 2,000,000');

        await allowances.actions.approve(['user', 'user2', '500.0000 ALLOW']).send('user');
        assert(await getAllowance('user', 'user2') === 500, 'Expected allowance to be 500');
    });
    it('should be able to spend allowances', async () => {
        // cannot spend from wrong user
        await expectToThrow(
            allowances.actions.spend(['user', 'user2', 'user2', '100.0000 ALLOW', 'memo']).send('user'),
            "missing required authority user2"
        );
        // owner has no escrow balance
        await expectToThrow(
            allowances.actions.spend(['user', 'user2', 'user2', '200.0000 ALLOW', 'memo']).send('user2'),
            "eosio_assert: Owner has no balance for this totem."
        );
        // cannot just send totems, needs to open balance first
        await expectToThrow(
            totems.actions.transfer(['user', 'allowances', '500.0000 ALLOW', 'escrow for allowances mod']).send('user'),
            "eosio_assert: You must open a balance first."
        );
        // open balance for allowances contract
        await allowances.actions.open(['user', '4,ALLOW']).send('user');

        // escrow some totems to owner
        await totems.actions.transfer(['user', 'allowances', '500.0000 ALLOW', 'escrow for allowances mod']).send('user');
        const balance = await getEscrowBalance('user');
        assert(balance === 500, `Expected escrow balance to be 500, got ${balance}`);

        const balanceBefore = getTotemBalance('user2', 'ALLOW');
        await allowances.actions.spend(['user', 'user2', 'user2', '200.0000 ALLOW', 'memo']).send('user2');
        assert(await getAllowance('user', 'user2') === 300, 'Expected allowance to be 300');
        const balanceAfter = getTotemBalance('user2', 'ALLOW');
        assert(balanceAfter - balanceBefore === 200, 'Expected user2 to have received 200 ALLOW');

        // spending more than allowance should fail
        await expectToThrow(
            allowances.actions.spend(['user', 'user2', 'user2', '400.0000 ALLOW', 'memo']).send('user2'),
            "eosio_assert: Insufficient allowance to spend."
        );
    });
    it('should be able to remove allowance', async () => {
        const allowanceBefore = await getAllowance('user', 'user2');
        await allowances.actions.approve(['user', 'user2', '0.0000 ALLOW']).send('user');
        const allowanceAfter = await getAllowance('user', 'user2');
        assert(allowanceBefore > 0, 'Expected allowance before to be greater than 0');
        assert(allowanceAfter === 0, 'Expected allowance after to be 0');
    });
    it('should no longer be able to spend allowances', async () => {
        await expectToThrow(
            allowances.actions.spend(['user', 'user2', 'user2', '100.0000 ALLOW', 'memo']).send('user2'),
            "eosio_assert: No allowance found for this spender."
        );
    });
    it('should be able to withdraw remaining escrow balance', async () => {
        const balance = await getEscrowBalance('user');
        assert(balance === 300, `Expected escrow balance to be 300, got ${balance}`);

        const balanceBefore = getTotemBalance('user', 'ALLOW');
        await allowances.actions.withdraw(['user', '300.0000 ALLOW', 'memo']).send('user');
        const balanceAfter = getTotemBalance('user', 'ALLOW');
        assert(balanceAfter - balanceBefore === 300, 'Expected user to have received 300 ALLOW back');
    });
});
