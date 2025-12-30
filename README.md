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