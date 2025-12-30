# Totem Mods!

I'm building out a bunch of totem mods to serve as a useful base for creators.

## Building

```shell
npm i
node scripts/build
```

## Testing

```shell
npm test
```


## Mods

### Wrapper Mod

Allows wrapping/unwrapping tokens to Totems from either standard `eosio.token` tokens, or other Totems.

<details>
<summary>Click to see details</summary>

**Setup:**
- `mod::setup` - Must be called to set up the wrapping configuration:
  - `totem_ticker` - The totem ticker to set up wrapping for
  - `wrappable_ticker` - The underlying token ticker that can be wrapped
  - `wrappable_contract` - The contract of the underlying token that can be wrapped

**Mint (wrap):**
- `token::transfer` - Transfer some wrappable tokens to the mod.
- `totems::mint` - Mint the corresponding amount of totem tokens to the desired account.
  - `mod` - This mod contract
  - `minter` - The account receiving the wrapped tokens
  - `quantity` - The amount of totem tokens to mint (must match the amount of underlying tokens transferred)
  - `payment` - `0.0000 A/EOS`
  - `memo` - `DECIMALS,TICKER,CONTRACT` (e.g. `4,A,core.vaulta`)

**Transfer (Unwrap):**
- `totems::transfer` - Transfer the wrapped tokens back to the mod.
  - `from` - The account sending the wrapped tokens
  - `to` - This mod contract
  - `quantity` - The amount of totem tokens to transfer (to be unwrapped)
  - `memo` - `DECIMALS,TICKER,CONTRACT` (e.g. `4,A,core.vaulta`)

</details>


### Miner Mod

A Minter Mod that allows accounts to "mine" tokens by submitting transactions to the chain that give them a fixed amount 
of tokens on every transaction.

<details>
<summary>Click to see details</summary>

**Setup:**
- `miner::configure` - Must be called to set up the miner configuration (can be called multiple times to update):
  - `ticker` - The totem ticker to set up mining for
  - `totems_per_mine` - How many totems to give per mine
  - `max_mines_per_day` - The maximum number of totems per day (0 for unlimited)

**Mint (mine):**
- `totems::mint` - Call this action to mine totems.
  - `mod` - This mod contract
  - `minter` - The account receiving the mined tokens
  - `quantity` - `0.0000 <TOTEM>`
  - `payment` - `0.0000 A/EOS`
  - `memo` - (optional) Any memo

</details>


### Transfer Controls

A transfer mod that allows the holder to set global or per-account daily transfer limits.

<details>
<summary>Click to see details</summary>

**Limit:**
- `mod::limit` - Set a global transfer limit or per-account limits.
  - `account` - The account to set the limit for (use `""` for global limit)
  - `ticker` - The totem ticker to set the limit for
  - `global_daily_limit` - The global daily transfer limit (0 for no limit)
  - `account_limits:AccountLimitParam[]` - A list of per-account daily limits

```typescript
type AccountLimitParam = {
    recipient: name;
    daily_limit: asset;
}
```

**Unlimit:**
- `mod::unlimit` - Remove per-account limits.
  - `account` - The account to remove the limit for (use `""` for global limit)
  - `ticker` - The totem ticker to remove the limit for
  - `accounts:name[]` - A list of accounts to remove limits for

> Note: To remove global limits, use `mod::limit` with `global_daily_limit` set to `0`.

**Transfer:**
- `totems::transfer` - Transfer totems as normal. The mod will enforce the limits set.

</details>

### Blocklist Mod

A transfer/mint/burn mod that allows the totem creator to blocklist accounts from transferring, minting, or burning tokens.

<details>
<summary>Click to see details</summary>

**Block:**
- `mod::block` - Block an account from transferring/minting/burning tokens.
  - `ticker` - The totem ticker to block the account for
  - `account` - The account to block

**Unblock:**
- `mod::unblock` - Unblock an account.
  - `ticker` - The totem ticker to unblock the account for
  - `account` - The account to unblock

**Transfer/mint/burn:**
- `totems::transfer` / `totems::mint` / `totems::burn` - The mod will enforce the blocklist on these actions.

</details>