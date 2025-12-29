import {Blockchain, nameToBigInt, expectToThrow, symbolCodeToBigInt} from "@vaulta/vert";
import {Asset, Checksum256} from "@wharfkit/antelope";
// @ts-ignore
import chai, { assert } from "chai";
import {TableStore} from "@vaulta/vert/dist/antelope/table";
chai.config.truncateThreshold = 0;

export const blockchain = new Blockchain();

const eos = blockchain.createContract('eosio.token', 'build/eosio.token', true);
const vaulta = blockchain.createContract('core.vaulta', 'build/core.vaulta',  true,{privileged: true});
const contract = blockchain.createContract('totemstotems', 'build/totems', true);
const market = blockchain.createContract('modsmodsmods', 'build/market',  true);

export const resetBlockchainTables = async (store: TableStore) => {
    blockchain.resetTables(store);
}

export const setup = async () => {
    // test
}