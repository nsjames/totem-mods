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
- `wrapper::setup` - Must be called to set up the wrapping configuration:
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