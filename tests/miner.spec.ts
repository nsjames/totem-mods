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

const miner = blockchain.createContract('miner', 'build/miner',  true);

describe('Miner', () => {
    it('should setup tests', async () => {
        await setup();
        await createAccount('seller')
        await createAccount('creator')
        await createAccount('user')
    })
    it('should be able to publish a mod, and create a totem', async () => {
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
            '4,MINED',
            [{ recipient: 'miner', quantity: 1_000_000_000, label: 'Mineable Totems', is_minter: true }],
            totemMods({
                mint: ['miner'],
            }),
        )

        const balance = getTotemBalance('miner', 'MINED');
        assert(balance === 1_000_000_000, `Expected balance to be 1_000_000_000, got ${balance}`);

        // need to set up mod
        // 10 totems per mine, 100 totems per day
        await miner.actions.configure(['MINED', 10_0000, 100_0000]).send('creator');
    });
    it('should be able to mine totems', async () => {
        const timeStarted = TimePointSec.fromMilliseconds(Date.now());
        blockchain.setTime(timeStarted);

        await totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user');
        {
            const balance = getTotemBalance('user', 'MINED');
            assert(balance === 10, `Expected balance to be 10 MINED, got ${balance}`);
        }

        for(let i=0; i<9; i++){
            await totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user');
        }

        {
            const balance = getTotemBalance('user', 'MINED');
            assert(balance === 100, `Expected balance to be 100 MINED, got ${balance}`);
        }

        await expectToThrow(
            totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user'),
            "eosio_assert: Daily mining limit reached"
        )

        const oneDayLater = TimePointSec.fromMilliseconds(Date.now() + 24 * 60 * 60 * 1000 + 1000);
        blockchain.setTime(oneDayLater);

        await totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user');
        {
            const balance = getTotemBalance('user', 'MINED');
            assert(balance === 110, `Expected balance to be 110 MINED, got ${balance}`);
        }
    });
    it('should be able to change the config in the middle of a window', async () => {
        await miner.actions.configure(['MINED', 1_0000, 10_0000]).send('creator');

        await expectToThrow(
            totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user'),
            "eosio_assert: Daily mining limit reached"
        )

        const oneDayLater = TimePointSec.fromMilliseconds(Date.now() + 2 * 24 * 60 * 60 * 1000 + 1000);
        blockchain.setTime(oneDayLater);

        await totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user');
        {
            const balance = getTotemBalance('user', 'MINED');
            assert(balance === 111, `Expected balance to be 111 MINED, got ${balance}`);
        }
    });
    it('should be able to make it unlimited', async () => {
        await miner.actions.configure(['MINED', 100_0000, 0]).send('creator');

        for(let i=0; i<100; i++){
            await totems.actions.mint(['miner', 'user', '0.0000 MINED', '0.0000 A', '']).send('user');
        }

        {
            const balance = getTotemBalance('user', 'MINED');
            const expected = 111 + (100*100);
            assert(balance === expected, `Expected balance to be ${expected} MINED, got ${balance}`);
        }
    });
});
