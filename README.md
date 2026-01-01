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

### 🟢 Wrapper

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


### 🟢 Miner

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


### 🟢 Transfer Controls

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

### 🟢 Blocklist

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

### 🟢 ScamDefender

A transfer/mint/burn mod that allows a central authority to blocklist accounts from transferring, minting, or burning 
tokens.

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

### 🟢 Freezer

A transfer/mint/burn mod that allows the totem creator to freeze all transfers, mints, and burns of a totem.

<details>
<summary>Click to see details</summary>

**Freeze:**
- `mod::freeze` - Freeze all transfers/mints/burns of a totem.
  - `ticker` - The totem ticker to freeze

**Unfreeze:**
- `mod::thaw` - Unfreeze all transfers/mints/burns of a totem.
  - `ticker` - The totem ticker to unfreeze

**Transfer/mint/burn:**
- `totems::transfer` / `totems::mint` / `totems::burn` - The mod will enforce the freeze on these actions.

</details>

### 🟢 Inner Circle

A transfer/mint/burn mod that disallows everyone except a specific list of accounts from transferring, minting, or burning tokens.

Creator is always a member.
Only creator can remove members, but members can add other members.

<details>
<summary>Click to see details</summary>

**Toggle Member:**
- `mod::togglemember` - Toggle an account's membership in the inner circle.
  - `ticker` - The totem ticker to modify
  - `sponsor` - The account performing the action (must be a member)
  - `account` - The account to toggle membership for

**Transfer/mint/burn:**
- `totems::transfer` / `totems::mint` / `totems::burn` - The mod will enforce the inner circle on these actions.

</details>

### 🟢 Proxy Hooks

Allows a creator to set up **_mutable_** mods on a totem that can be changed by the creator at any time.

> Required payments for mods, if any, and are paid directly to the developer of the mod just like the market and 
> original totem creation flow.

<details>
<summary>Click to see details</summary>

**Add Hook<>Mod:**
- `mod::add` - Add a mod to a hook for a totem.
  - `ticker` - The totem ticker to modify
  - `hooks:name[]` - The hooks to add the mod to (`transfer`, `mint`, `burn`, etc)
  - `mod` - The account to toggle membership for
- **MIGHT REQUIRE PAYMENT**
    - `eosio.token/core.vaulta::transfer` - Payment to the mod developer for adding the mod, see the 
      market for pricing

**Remove Hook<>Mod:**
- `mod::remove` - Remove a mod from a hook for a totem.
  - `ticker` - The totem ticker to modify
  - `hook` - The hook to remove the mod from (`transfer`, `mint`, `burn`, etc)
  - `mod` - The account to toggle membership for

**All Hooks:**
- The mod will forward all hooked actions to the added mods for processing.

</details>

### 🟢 Extinguisher

Removes burn functionality from a totem.

<details>
<summary>Click to see details</summary>

**Burn:**
- `totems::burn` - The mod will prevent any burns from occurring.

</details>


### 🟢 Whale Block

A transfer/mint mod that blocks accounts from holding over a certain amount of tokens.

<details>
<summary>Click to see details</summary>

**Toggle Member:**
- `mod::configure` - Toggle an account's membership in the inner circle.
  - `ticker` - The totem ticker to modify
  - `max_holdings_percent` - The maximum percentage of total supply an account can hold (0-100, 0 for no limit)
  - `max_totem_cap` - A hard cap on the maximum number of totems an account can hold (0 for no limit)

> Note: You cannot have both limits set at the same time.

**Transfer/mint:**
- `totems::transfer` / `totems::mint` - The mod will enforce the whale block on these actions.

</details>

### 🟢 KYC

A transfer/mint mod that blocks accounts that haven't gone through KYC from interacting with totems.

> Note: KYC applies immediately to all accounts across all totems. 
> If you add this mod to your totem holders that have previously KYCed will be able to use your 
> totem right away.

<details>
<summary>Click to see details</summary>

**Add Manager:**
- `mod::addmanager` - Adds a manager that can manage KYC'ed accounts.
  - `account` - The account to add as a manager

> Only the contract can add managers.

**Remove Manager:**
- `mod::delmanager` - Removes a manager.
  - `account` - The account to remove as a manager

> Only the contract can remove managers.

**Manage KYC:**
- `mod::setkyc` - Sets the KYC status of an account.
  - `manager` - The manager performing the action
  - `account` - The account to set the KYC status for
  - `has_kyc` - Whether the account has passed KYC

> KYC can be revoked and re-granted at any time.

**Transfer/mint:**
- `totems::transfer` / `totems::mint` - The mod will enforce KYC on these actions.

</details>

### 🟢 Approvals

A transfer mod that works like ERC20's `approve`/`transferFrom`, allowing accounts to approve other accounts to transfer tokens on their behalf.

> Note: This works like an escrow, since mods cannot bypass the require_auth of the `totems::transfer`.

<details>
<summary>Click to see details</summary>

**Open Balance:**
- `mod::open` - Open a balance for an account to hold tokens.
  - `owner` - The account opening the balance
  - `ticker:symbol` - The totem ticker to open the balance for

**Deposit:**
- `totems::transfer` - Transfer tokens to the mod account.
  - `from` - The account sending the tokens
  - `to` - This mod contract
  - `quantity` - The amount of totem tokens to transfer
  - `memo` - (optional) Any memo

**Transfer:**
- `mod::transfer` - Transfer tokens from the owner's escrow balance to a recipient.
  - `from` - The account sending the tokens
  - `to` - The account receiving the tokens
  - `quantity` - The amount of totem tokens to transfer
  - `memo` - (optional) Any memo

> Note: Can send to self to withdraw from escrow.

**Approve:**
- `mod::approve` - Approve an account to transfer tokens on your behalf.
  - `owner` - The account approving the transfer
  - `spender` - The account being approved to transfer tokens
  - `quantity` - The amount of tokens to approve


**Spend:**
- `mod::spend` - Transfer tokens on behalf of another account.
  - `owner` - The owner of the totems
  - `spender` - The account spending the totems
  - `recipient` - The account receiving the totems
  - `quantity` - The amount of totem tokens to transfer
  - `memo` - (optional) Any memo

**Read-only Actions:**

```cpp
// Get the allowance an owner has given a spender
asset getallowance(const name& owner, const name& spender, const symbol& ticker)

// Check if an account has an open balance
bool isopen(const name& owner, const symbol& ticker)

// Get the escrow balance of an account
asset getbalance(const name& owner, const symbol& ticker)
```

</details>

### 🟢 x402

A transfer mod that works like x402, allowing accounts to approve other accounts to transfer tokens on their behalf for 
a single-use.

> Note: This works like an escrow, since mods cannot bypass the require_auth of the `totems::transfer`.

<details>
<summary>Click to see details</summary>

**Open Balance:**
- `mod::open` - Open a balance for an account to hold tokens.
  - `owner` - The account opening the balance
  - `ticker:symbol` - The totem ticker to open the balance for

**Deposit:**
- `totems::transfer` - Transfer tokens to the mod account.
  - `from` - The account sending the tokens
  - `to` - This mod contract
  - `quantity` - The amount of totem tokens to transfer
  - `memo` - (optional) Any memo

**Transfer:**
- `mod::transfer` - Transfer tokens from the owner's escrow balance to a recipient.
  - `from` - The account sending the tokens
  - `to` - The account receiving the tokens
  - `quantity` - The amount of totem tokens to transfer
  - `memo` - (optional) Any memo

> Note: Can send to self to withdraw from escrow.

**Authorize:**
- `mod::authorize` - Authorize an account to transfer totems on your behalf for a single-use.
  - `owner` - The account approving the transfer
  - `spender` - The account being approved to transfer totems
  - `quantity` - The amount of totems to approve
  - `request_hash` - A hash of the request data (to prevent replay attacks)
  - `expires_sec` - How many seconds until this authorization expires
  - RETURNS: `Intent`

> Note: This locks up the totems in escrow until the intent is either consumed or revoked.

**Intent Structure:**
```cpp
struct [[eosio::table]] Intent {
    uint64_t        id;
    name            owner;
    name            consumer;     // API / mod / service
    asset           price;
    checksum256     request_hash; // binds to API request
    time_point_sec  expires;
};
```

**Revoke:**
- `mod::revoke` - Revoke a previously created intent (owner only).
  - `id` - The ID of the intent to revoke

> Note: This unlocks the totems in escrow.

**Consume:**
- `mod::consume` - Consume an authorization to transfer totems on behalf of another account.
  - `id` - The ID of the intent to consume
  - `request_hash` - The hash of the request data (must match the original)
  - RETURNS: `bool` indicating success
    - If false this intent is expired, and it removes the intent and unlocks the totems

**Read-only Actions:**

```cpp
// Get the allowance an owner has given a spender
asset getallowance(const name& owner, const name& spender, const symbol& ticker)

// Check if an account has an open balance
bool isopen(const name& owner, const symbol& ticker)

// Get the escrow balance of an account
asset getbalance(const name& owner, const symbol& ticker)

// Get the locked balance of an account
asset getlockedbal(const name& owner, const symbol& ticker)

// Get an intent by ID
std::optional<Intent> getintent(const uint64_t& id)

struct MyIntentsResult {
    std::vector<Intent> intents;
    std::optional<uint128_t> cursor;
};

// Get all intents for an owner with pagination
MyIntentsResult getmyintents(const name& owner, const uint32_t& limit, const std::optional<uint128_t>& cursor)
```

</details>