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

const x4o2 = blockchain.createContract('x4o2', 'build/x402',  true);

const HASH = '1110762033e7a10db4502359a19a61eb81312834769b8419047a2c9ae03ee847';

const getIntent = async (id:number) => {
    const intent = await x4o2.actions.getintent([id]).send();
    if(!intent.length) return null;
    return JSON.parse(JSON.stringify(intent[0].returnValue));
}

const getEscrowBalance = async (account: string) => {
    return parseFloat(JSON.parse(JSON.stringify(
        (await x4o2.actions.getbalance([account, '4,XPAY']).send())[0].returnValue)
    ).split(' ')[0])
}

const getLockedEscrowBalance = async (account: string) => {
    return parseFloat(JSON.parse(JSON.stringify(
        (await x4o2.actions.getlockedbal([account, '4,XPAY']).send())[0].returnValue)
    ).split(' ')[0])
}

const getMyIntents = async (account: string, limit = 100, cursor = null) => {
    const intents = await x4o2.actions.getmyintents([account, limit, cursor]).send();
    return JSON.parse(JSON.stringify(intents[0].returnValue));
}

describe('x402', () => {
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
            'x4o2',
            [
                MOD_HOOKS.Transfer,
            ],
            0,
            MOCK_MOD_DETAILS(false),
        )

        await createTotem(
            '4,XPAY',
            [{ recipient: 'user', quantity: 1_000_000, label: 'User', is_minter: false }],
            totemMods({
                transfer: ['x4o2'],
            }),
        )

    });
    it('should be able to transfer normally', async () => {
        await totems.actions.transfer(['user', 'user2', '1.0000 XPAY', 'memo']).send('user');
    });
    it('should be able to create an intent', async () => {
        // cannot create an intent without a lockable balance
        await expectToThrow(
            x4o2.actions.authorize(['user', 'user2', '300.0000 XPAY', HASH, 84600]).send('user'),
            "eosio_assert: No balance for this totem"
        );
        // open balance for x4o2 contract
        await x4o2.actions.open(['user', '4,XPAY']).send('user');
        // transfer some totems to escrow
        await totems.actions.transfer(['user', 'x4o2', '500.0000 XPAY', 'escrow for x4o2 mod']).send('user');
        const balance = await getEscrowBalance('user');
        assert(balance === 500, `Expected escrow balance to be 500, got ${balance}`);

        const intent = JSON.parse(JSON.stringify(
            (await x4o2.actions.authorize(['user', 'user2', '300.0000 XPAY', HASH, 84600]).send('user'))[0].returnValue
        ));

        assert(intent.id === 0, `Expected intent id to be 0, got ${intent.id}`);
        assert(intent.owner === 'user', `Expected intent owner to be user, got ${intent.owner}`);
        assert(intent.consumer === 'user2', `Expected intent consumer to be user2, got ${intent.consumer}`);
        assert(intent.price === '300.0000 XPAY', `Expected intent price to be 300.0000 XPAY, got ${intent.price}`);
        assert(intent.request_hash === HASH, `Expected intent hash to be ${HASH}, got ${intent.request_hash}`);
        assert(intent.expires === '1970-01-01T23:30:00', `Expected intent expiration to be  +84600, got ${intent.expires}`);
    });
    it('should be able to consume an intent', async () => {
        const intentBefore = await getIntent(0);
        assert(!!intentBefore, 'Expected intent to exist before consumption');

        // should not be able to consume with wrong hash
        await expectToThrow(
            x4o2.actions.consume([0, '8810ad581e59f2bc3928b261707a71308f7e139eb04820366dc4d5c18d980225']).send('user2'),
            "eosio_assert: Request hash does not match."
        );

        // should not be able to consume from wrong user
        await expectToThrow(
            x4o2.actions.consume([0, HASH]).send('user3'),
            "missing required authority user2"
        );

        // should not be able to consume without authority
        await expectToThrow(
            x4o2.actions.consume([0, HASH]).send('user3'),
            "missing required authority user2"
        );

        await x4o2.actions.consume([0, HASH]).send('user2');

        const intentAfter = await getIntent(0);
        assert(!intentAfter, 'Expected intent to be removed after consumption');
    });
    it('should be able to revoke an unused intent', async () => {
        const unlockedBalanceBefore = await getEscrowBalance('user');
        const lockedBalanceBefore = await getLockedEscrowBalance('user');

        assert(lockedBalanceBefore === 0, `Expected locked balance to be 0, got ${lockedBalanceBefore}`);
        assert(unlockedBalanceBefore === 200, `Expected unlocked balance to be 200, got ${unlockedBalanceBefore}`);

        const intent = JSON.parse(JSON.stringify(
            (await x4o2.actions.authorize(['user', 'user2', '100.0000 XPAY', HASH, 84600]).send('user'))[0].returnValue
        ));

        assert(await getLockedEscrowBalance('user') === 100, 'Expected locked balance to be 100 after creating intent');
        assert(await getEscrowBalance('user') === 100, 'Expected unlocked balance to be 100 after creating intent');

        assert(intent.id === 1, `Expected intent id to be 1, got ${intent.id}`);
        const intentBefore = await getIntent(1);
        assert(!!intentBefore, 'Expected intent to exist before revocation');

        await x4o2.actions.revoke([1]).send('user');

        assert(await getLockedEscrowBalance('user') === 0, 'Expected locked balance to be 0 after revoking intent');
        assert(await getEscrowBalance('user') === 200, 'Expected unlocked balance to be 200 after revoking intent');

        const intentAfter = await getIntent(1);
        assert(!intentAfter, 'Expected intent to be removed after revocation');
    });
    it(`should be able to get all of a user's intents`, async () => {
        for(let i=0; i<5; i++){
            await x4o2.actions.authorize(['user', 'user2', `1.0000 XPAY`, HASH, 84600 + (i*60)]).send('user');
        }

        const {cursor, intents} = await getMyIntents('user', 2);
        assert(intents.length === 2, `Expected 2 intents, got ${intents.length}`);
        assert(cursor !== null, 'Expected cursor to be not null');
        assert(intents[0].id === 2, `Expected first intent id to be 2, got ${intents[0].id}`);
        assert(intents[0].expires === '1970-01-01T23:30:00', `Expected first intent expiration to be  +84600, got ${intents[0].expires}`);
        assert(intents[1].id === 3, `Expected second intent id to be 3, got ${intents[1].id}`);
        assert(intents[1].expires === '1970-01-01T23:31:00', `Expected second intent expiration to be +84660, got ${intents[1].expires}`);

        const {cursor: cursor2, intents: intents2} = await getMyIntents('user', 2, cursor);
        assert(intents2.length === 2, `Expected 2 intents, got ${intents2.length}`);
        assert(cursor2 !== null, 'Expected cursor2 to be not null');
        assert(intents2[0].id === 4, `Expected first intent id to be 4, got ${intents2[0].id}`);
        assert(intents2[0].expires === '1970-01-01T23:32:00', `Expected first intent expiration to be +84720, got ${intents2[0].expires}`);
        assert(intents2[1].id === 5, `Expected second intent id to be 5, got ${intents2[1].id}`);
        assert(intents2[1].expires === '1970-01-01T23:33:00', `Expected second intent expiration to be +84780, got ${intents2[1].expires}`);
    });
    it('should be able to transfer escrow balance', async () => {
        const balance = await getEscrowBalance('user');
        assert(balance === 195, `Expected escrow balance to be 195, got ${balance}`);

        const balanceBefore = getTotemBalance('user', 'XPAY');
        await x4o2.actions.transfer(['user', 'user', '50.0000 XPAY', 'memo']).send('user');
        const balanceAfter = getTotemBalance('user', 'XPAY');
        assert(balanceAfter - balanceBefore === 50, 'Expected user to have received 50 XPAY');

        // can also transfer not to self (non-withdraw)
        await x4o2.actions.transfer(['user', 'user3', '50.0000 XPAY', 'memo']).send('user');
        assert(getTotemBalance('user3', 'XPAY') === 50, 'Expected user3 to have received 100 XPAY');

        // not enough balance to transfer
        await expectToThrow(
            x4o2.actions.transfer(['user', 'user', '200.0000 XPAY', 'memo']).send('user'),
            "eosio_assert: Insufficient balance."
        );
    });
});
