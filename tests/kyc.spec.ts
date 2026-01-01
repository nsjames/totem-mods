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

const kyc = blockchain.createContract('kyc', 'build/kyc',  true);
const miner = blockchain.createContract('miner', 'build/miner',  true);

describe('KYC', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
        await createAccount('user2')
        await createAccount('user3')
        await createAccount('manager1')
        await createAccount('manager2')
    })
    it('should be able to publish a mod, and create a totem', async () => {
        await publishMod(
            'seller',
            'kyc',
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
            '4,KYC',
            [
                { recipient: 'user', quantity: 10_000_000, label: 'Totems', is_minter: false },
                { recipient: 'user2', quantity: 10_000_000, label: 'Totems', is_minter: false },
                { recipient: 'user3', quantity: 10_000_000, label: 'Totems', is_minter: false },
                { recipient: 'miner', quantity: 10_000_000, label: 'Mineable Totems', is_minter: true }
            ],
            totemMods({
                transfer: ['kyc'],
                mint: ['miner'],
            }),
        )
    });
    it('should be able to add kyc managers', async () => {
        // can only send from the contract itself
        await expectToThrow(
            kyc.actions.addmanager(['manager1']).send('user'),
            "missing required authority kyc"
        );

        await kyc.actions.addmanager(['manager1']).send('kyc');
        await kyc.actions.addmanager(['manager2']).send('kyc');

        const managers = JSON.parse(JSON.stringify(kyc.tables.managers(nameToBigInt('kyc')).getTableRows()));
        assert(managers.length === 2, `Expected 2 managers, got ${managers.length}`);
        assert(managers[0].manager === 'manager1', `Expected manager1, got ${managers[0].manager}`);
        assert(managers[1].manager === 'manager2', `Expected manager2, got ${managers[1].manager}`);
    });
    it('should not be able to mine totems with a non-KYC account', async () => {
        await miner.actions.configure(['KYC', 10_0000, 0]).send('creator');

        await expectToThrow(
            totems.actions.mint(['miner', 'user', '0.0000 KYC', '0.0000 A', '']).send('user'),
            "eosio_assert: KYC required."
        );

        await kyc.actions.setkyc(['manager1','user', true]).send('manager1');
        await totems.actions.mint(['miner', 'user', '0.0000 KYC', '0.0000 A', '']).send('user');
    });
    it('should not be able to transfer totems with or to a non-KYC account', async () => {
        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '10.0000 KYC', 'memo']).send('user'),
            "eosio_assert: KYC required."
        );
        await expectToThrow(
            totems.actions.transfer(['user2', 'user3', '10.0000 KYC', 'memo']).send('user2'),
            "eosio_assert: KYC required."
        );

        await kyc.actions.setkyc(['manager1','user2', true]).send('manager1');
        await totems.actions.transfer(['user', 'user2', '10.0000 KYC', 'memo']).send('user');
    });
    it('should able to revoke KYC and stop transfers', async () => {
        await kyc.actions.setkyc(['manager2','user2', false]).send('manager2');

        await expectToThrow(
            totems.actions.transfer(['user', 'user2', '10.0000 KYC', 'memo']).send('user'),
            "eosio_assert: KYC required."
        );
    });
});
