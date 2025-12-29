# Welcome to your new Totem Mod!

This directory contains the template files for your new Totem mod. 
You can customize these files to create your own unique mod for the 
Totem platform.

Once you're ready to publish your Mod on the market, [click here.](https://totems.fun/publish)

## Developing Mods

> Want to see some examples? Head over to the [Totem repository's Mods section.](https://github.com/nsjames/totems/tree/main/contracts/mods)

Mods are a way to add functionality to [Totems](https://totems.fun) (a new blockchain token standard). 
They are event-driven programs that respond to token events such as transfers, mints, and burns.

On Vaulta, events happen as inline actions/functions within smart contracts. 
Mods listen for these events and execute custom logic in response.

### What mods CAN'T do

Mods cannot modify the core functionality of Totem tokens. They are designed to be safe and secure,
operating within the boundaries set by the Totem standard.

This means you can't directly change a user's token balances, change burn amounts, or alter transfer logic.

### What mods CAN do

Pretty much everything else. Mods can read token balances, track ownership history, enforce custom rules,
fail transactions based on specific conditions, and much more. Mods can also interact with other smart contracts on the blockchain,
allowing for complex behaviors and integrations.

Some examples of what mods can do include:
- Enforcing KYC rules on token transfers
- Enforcing holding periods before tokens can be transferred
- Enabling per-hour/day/account transfer limits
- Rewarding holders with additional tokens or benefits

The possibilities are endless!

### Required Actions

Because you can't directly modify core token functionality, mods might want to force certain actions to occur 
simultaneously with token events. For example, a mod might want to burn a portion of tokens on each transfer.
To facilitate this, Totem mods can return a list of "required actions" that the holder will need to sign together
with the transaction. These run atomically, and if they aren't included, the transaction will fail.

This allows you to do things like:
- Make a user send a tax on each transfer
- Enforce that a user stakes tokens when they receive them
- Pay for mod usage on every transfer

## Build your Mod

To build your mod, run the following command in your terminal:

```
node scripts/build
```

If you have CDT installed, it will use that. If not it will use Docker.

## Testing your Mod

This repository has a `/tests/mod.spec.ts` with an example test that 
shows you how to test your mods using Vert.

To run the tests, use the following command:

```
npm run test
```

> Note: You cannot test required actions in Vert yet, as it does not support multi-action transactions.

## Upgrading from upstream

There are a few files that might be upgraded from upstream Totem changes.

- `contracts/lib/totem.hpp`
- `prebuilts`
- `tests/helpers.ts`

To upgrade these files, you can use the following commands:

```
npx @totems/mods sync template
```

This will copy the latest versions of these files from the Totem repository into your mod directory.

> Note: It will show you a diff of everything but the `prebuilts` folder, so you can review changes before applying them.
> The `prebuilts` folder is copied directly without showing a diff as you couldn't reason about the 
> WASM or ABI changes easily.