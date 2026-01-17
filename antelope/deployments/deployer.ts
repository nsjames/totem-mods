// @ts-ignore
import fs from "fs";
import {ABI, PermissionLevel} from "@wharfkit/session";
import {Serializer} from "@wharfkit/antelope";

export const deployContract = async (session:any, wasmPath:string, abiPath:string, account:string) => {
    const wasm = fs.readFileSync(wasmPath);
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    const estimatedRam = (wasm.byteLength * 10) + JSON.stringify(abi).length;

    const accountInfo = await session.client.v1.chain.get_account(account).catch(err => {
        console.error(err);
        return {
            ram_quota: 0,
            ram_usage: 0,
            last_code_update: '1970-01-01T00:00:00.000',
        };
    });

    let previousCodeSize = 0;
    if(accountInfo.last_code_update !== '1970-01-01T00:00:00.000'){
        const previousCode = await session.client.v1.chain.get_code(account).catch(err => {
            console.error('Error getting previous code: ', err);
            return {
                code_hash: '',
                wasm: '',
                abi: {},
            };
        });
        previousCodeSize = (previousCode.wasm.length * 10) + JSON.stringify(previousCode.abi || "").length;
    }

    const freeRam = parseInt(accountInfo.ram_quota.toString()) - parseInt(accountInfo.ram_usage.toString());
    const extraRamRequired = estimatedRam - previousCodeSize;

    const ramRequired = freeRam > extraRamRequired ? 0 : extraRamRequired - freeRam;

    const permissionLevels = [PermissionLevel.from({
        actor: account,
        permission: 'active',
    })];

    console.log(Serializer.encode({
        object: abi,
        type: ABI
    }).toString());

    let actions:any = [
        {
            account: 'core.vaulta',
            name: 'setcode',
            data: {
                account,
                vmtype: 0,
                vmversion: 0,
                code: wasm.toString('hex'),
            },
            authorization: permissionLevels,
        },
        {
            account: 'core.vaulta',
            name: 'setabi',
            data: {
                account,
                abi: Serializer.encode({
                    object: abi,
                    type: ABI
                }),
            },
            authorization: permissionLevels,
        }
    ];

    if(ramRequired > 0){
        actions.unshift({
            account: 'core.vaulta',
            name: 'buyrambytes',
            data: {
                payer: account,
                receiver: account,
                bytes: ramRequired + 256, // add extra buffer
            },
            authorization: permissionLevels,
        });
    }

    return await session.transact({
        actions,
    }).catch(err => {
        if(err.message === 'contract is already running this version of code'){
            return true;
        }

        throw err;
    });
}

export const addCodePermission = async (session:any, account:string) => {
    const accountInfo = await session.client.v1.chain.get_account(account);
    const permissions = accountInfo.permissions;
    const activePermission = permissions.find((perm: any) => perm.perm_name.toString() === 'active');
    const hasCodePermission = activePermission.required_auth.accounts.some((auth: any) => auth.permission.actor.toString()
        === account && auth.permission.permission.toString() === 'eosio.code');
    if(hasCodePermission) return;


    // update active permissions to have its current permission + <account>@eosio.code
    return await session.transact({
        actions: [
            {
                account: 'core.vaulta',
                name: 'buyrambytes',
                data: {
                    payer: account,
                    receiver: account,
                    bytes: 500,
                },
                authorization: [{
                    actor: account,
                    permission: 'active',
                }],
            },
            {
                account: 'eosio',
                name: 'updateauth',
                data: {
                    account,
                    permission: 'active',
                    parent: 'owner',
                    auth: {
                        threshold: 1,
                        keys: activePermission.required_auth.keys,
                        accounts: [
                            ...activePermission.required_auth.accounts,
                            {
                                permission: {
                                    actor: account,
                                    permission: 'eosio.code',
                                },
                                weight: 1,
                            }
                        ],
                        waits: [],
                    },
                },
                authorization: [{
                    actor: account,
                    permission: 'active',
                }],
            }
        ]
    });
}

export const randomName = () => {
    // 12 char name (a-z, 1-5)
    const chars = 'abcdefghijklmnopqrstuvwxyz12345';
    let name = '';
    for (let i = 0; i < 12; i++) {
        name += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return name;
}

export const createAccount = async (session, publicKey) => {
    const name = randomName();
    return await session.transact({
        actions: [
            {
                account: 'eosio',
                name: 'newaccount',
                authorization: [{
                    actor: session.actor,
                    permission: 'active',
                }],
                data: {
                    creator: session.actor.toString(),
                    name: name,
                    owner: {
                        threshold: 1,
                        keys: [{
                            key: publicKey.toString(),
                            weight: 1
                        }],
                        accounts: [],
                        waits: []
                    },
                    active: {
                        threshold: 1,
                        keys: [{
                            key: publicKey.toString(),
                            weight: 1
                        }],
                        accounts: [],
                        waits: []
                    }
                }
            },
            {
                account: 'eosio',
                name: 'buyrambytes',
                authorization: [{
                    actor: session.actor,
                    permission: 'active',
                }],
                data: {
                    payer: session.actor.toString(),
                    receiver: name,
                    bytes: 8192,
                }
            }
        ]
    });
    return name;
}

export const powerupAccount = async (session, account:string) => {
    await session.transact({
        actions: [
            {
                account: 'core.vaulta',
                name: 'buyrambytes',
                authorization: [{
                    actor: session.actor,
                    permission: 'active',
                }],
                data: {
                    payer: session.actor.toString(),
                    receiver: account,
                    bytes: 1000,
                }
            },
            {
                account: 'core.vaulta',
                name: 'powerup',
                authorization: [{
                    actor: session.actor,
                    permission: 'active',
                }],
                data: {
                    payer: session.actor.toString(),
                    receiver: account,
                    days: 1,
                    net_frac: 10000000000,
                    cpu_frac: 1000000000000,
                    max_payment: '10.0000 A',
                }
            }
        ]
    });
}

export const getBalance = async (session, account:string) => {
    const balances = await session.client.v1.chain.get_currency_balance('core.vaulta', account, 'A');
    if(balances.length === 0) return 0;
    return parseFloat(balances[0].toString().split(' ')[0]);
}

export const transferTokens = async (session, from:string, to:string, quantity:string) => {
    return await session.transact({
        actions: [
            {
                account: quantity.includes('EOS') ? 'eosio.token' : 'core.vaulta',
                name: 'transfer',
                authorization: [{
                    actor: from,
                    permission: 'active',
                }],
                data: {
                    from,
                    to,
                    quantity,
                    memo: '',
                }
            }
        ]
    });
}