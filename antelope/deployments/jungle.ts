import {addCodePermission, deployContract, getBalance, powerupAccount, transferTokens} from "./deployer";
import {Chains, Session} from "@wharfkit/session";
import {WalletPluginPrivateKey} from "@wharfkit/wallet-plugin-privatekey";
import {TransactPluginResourceProvider} from "@wharfkit/transact-plugin-resource-provider";
import {TransactPluginAutoCorrect} from '@wharfkit/transact-plugin-autocorrect'

const sessionParams = {
    chain: Chains.Jungle4,
    walletPlugin: new WalletPluginPrivateKey(process.env.JUNGLE_KEY),
    transactPlugins: [
        new TransactPluginResourceProvider({
            allowFees: true,
        }),
        new TransactPluginAutoCorrect(),
    ],
    permission: 'active',
}

const MODS = {
    // 'allowances': 'allowancemod',
    // 'blocklist': 'blocklistmod',
    // 'extinguisher': 'extinguisher',
    // 'freezer': 'freezermod11',
    // 'innercircle': 'innercircles',
    // 'kyc': 'kyckyckyckyc',
    // 'miner': 'minermod1111',
    // 'proxy': 'proxymod1111',
    // 'scamdefender': 'scamdefender',
    // 'controls':'xfercontrols',
    // 'whaleblock': 'whaleblocker',
    'wrapper': 'wrappermod11',
    'x402': 'x4o2x4o2x4o2'
};

(async() => {
    const modsSession = new Session(Object.assign(sessionParams, {
        actor: 'modsmodsmods',
    }));
    for(const [mod, account] of Object.entries(MODS)){
        await new Promise(r => setTimeout(r, 1000));
        console.log(`Deploying ${mod} to account ${account}...`);
        const balance = await getBalance(modsSession, account);
        if(balance < 2000){
            await powerupAccount(modsSession, 'modsmodsmods');
            await transferTokens(modsSession, 'modsmodsmods', account, '2000.0000 A', `Initial funding for ${mod} deployment`);
            await new Promise(r => setTimeout(r, 1000));
        }
        const session = new Session(Object.assign(sessionParams, {
            actor: account,
        }));
        await powerupAccount(session, account);
        await addCodePermission(session, account);
        await new Promise(r => setTimeout(r, 1000));
        await deployContract(
            session,
            `./build/${mod}.wasm`,
            `./build/${mod}.abi`,
            account
        );
    }
})();