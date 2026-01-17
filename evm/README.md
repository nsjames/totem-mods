# Totem Mods!

[Totems](https://totems.fun) are a new blockchain token standard that supports modular functionality via "Mods".
Mods are event-driven programs that respond to token events such as transfers, mints, and burns.
Totem creators can mix-match mods to create unique token behaviors through an easy UI instead of complex smart contract coding.
There is a market for mods that allows mod developers to get paid every time a mod is stacked into a totem.

This is all early software, and if it interests you feel free to join [our telegram](https://t.me/totemize)
to discuss, influence the direction, or ask questions. Also here is the [core EVM code.](https://github.com/nsjames/totems-evm)

Below is a list of the mods that I have built out as examples and useful base functionality.

## Building

```shell
npm install
npx hardhat compile
```

## Testing

```shell
npm test
```

## Coverage

```shell
npm run coverage
```

## Mods

### 🟢 Wrapper

Allows wrapping/unwrapping ERC20 tokens to Totems.

<details>
<summary>Click to see details</summary>

**Setup:**
- `setAcceptedToken(ticker, token)` - Must be called by the creator to set up the wrapping configuration:
  - `ticker` - The totem ticker to set up wrapping for
  - `token` - The ERC20 token address that can be wrapped

**Wrap:**
1. Approve the Wrapper contract to spend your ERC20 tokens
2. Transfer totems to the Wrapper contract with memo containing the amount to wrap
3. The Wrapper will pull ERC20 tokens from your wallet and credit you totem tokens

**Unwrap:**
- `totems.transfer(ticker, to: wrapperAddress, amount, memo)` - Transfer wrapped totems back to the Wrapper
  - The Wrapper will send you the underlying ERC20 tokens

</details>


### 🟢 Miner

A Minter Mod that allows accounts to "mine" tokens by submitting transactions to the chain that give them a fixed amount of tokens on every transaction.

<details>
<summary>Click to see details</summary>

**Setup:**
- `setup(ticker, totemsPerMine, maxMinesPerDay)` - Must be called by the creator to configure mining:
  - `ticker` - The totem ticker to set up mining for
  - `totemsPerMine` - How many totems to give per mine
  - `maxMinesPerDay` - The maximum number of mines per day per user (0 for unlimited)

**Validator:**
- `canSetup(ticker, totemsPerMine, maxMinesPerDay)` - Check if setup parameters are valid

**Mint (mine):**
- `totems.mint(ticker, minter, amount: 0, memo)` - Call this to mine totems
  - Amount must be 0 (the miner determines the amount)
  - No payment required

</details>


### 🟢 Transfer Controls

A transfer mod that allows holders to set their own daily and weekly transfer limits.

<details>
<summary>Click to see details</summary>

**Set Limits:**
- `setDailyLimit(ticker, limit)` - Set your own daily transfer limit
  - `ticker` - The totem ticker
  - `limit` - Maximum amount you can transfer per day (0 for no limit)

- `setWeeklyLimit(ticker, limit)` - Set your own weekly transfer limit
  - `ticker` - The totem ticker
  - `limit` - Maximum amount you can transfer per week (0 for no limit)

**Transfer:**
- `totems.transfer` - The mod will enforce the limits you've set on yourself

</details>


### 🟢 Blocklist

A transfer/mint/burn mod that allows the totem creator to blocklist accounts from transferring, minting, or burning tokens.

<details>
<summary>Click to see details</summary>

**Toggle Block:**
- `toggle(ticker, account)` - Toggle an account's blocked status (creator only)
  - `ticker` - The totem ticker
  - `account` - The account to block/unblock

**Check Status:**
- `blocked(ticker, account)` - Returns whether an account is blocked

**Transfer/mint/burn:**
- The mod will revert if sender or recipient is blocked

</details>


### 🟢 ScamDefender

A transfer mod that allows managers to blocklist known scam addresses from receiving tokens.

<details>
<summary>Click to see details</summary>

**Manage Managers:**
- `setManager(account, isManager)` - Add or remove a manager (manager only)

**Toggle Block:**
- `toggle(account)` - Toggle an address's scam status (manager only)
  - Applies globally across all totems using this mod

**Transfer:**
- The mod will revert transfers TO flagged scam addresses
- Flagged addresses can still send tokens (to recover funds)

</details>


### 🟢 Freezer

A transfer mod that allows the totem creator to freeze all transfers.

<details>
<summary>Click to see details</summary>

**Toggle Freeze:**
- `toggle(ticker)` - Toggle the frozen state of a totem (creator only)

**Check Status:**
- `frozen(ticker)` - Returns whether a totem is frozen

**Transfer:**
- The mod will revert all transfers while frozen

</details>


### 🟢 Inner Circle

A transfer/mint/burn mod that restricts token operations to members only. Features sponsorship-based membership and vote-based removal.

<details>
<summary>Click to see details</summary>

**Membership:**
- Creator is always a member (implicit)
- Minter mods are excluded from membership checks

**Add Member:**
- `addMember(ticker, account)` - Add a new member
  - Creator can add anyone
  - Existing members can sponsor new members

**Vote to Remove:**
- `voteToRemove(ticker, target)` - Cast a vote to remove a member
  - Only members can vote
  - Cannot vote to remove the creator
  - Member is auto-removed when >50% of eligible voters vote

**Retract Vote:**
- `retractVote(ticker, target)` - Retract your removal vote

**Transfer/mint/burn:**
- The mod will revert if sender or recipient is not a member

</details>


### 🟢 Extinguisher

Removes burn functionality from a totem.

<details>
<summary>Click to see details</summary>

**Burn:**
- The mod will revert any burn attempts with "Burning is disabled"

</details>


### 🟢 Whale Block

A transfer mod that prevents any address from holding more than a percentage of total supply.

<details>
<summary>Click to see details</summary>

**Configure:**
- `configure(ticker, maxTokenPercentage)` - Set the maximum percentage (creator only)
  - `ticker` - The totem ticker
  - `maxTokenPercentage` - Maximum % of supply any address can hold (0 for no limit)

**Transfer:**
- The mod will revert if the transfer would cause the recipient to exceed the limit
- Minter mods are excluded from whale checks

</details>


### 🟢 KYC

A transfer/mint/burn mod that requires accounts to pass KYC verification before interacting with tokens.

<details>
<summary>Click to see details</summary>

**Manage Managers:**
- `setManager(account, isManager)` - Add or remove a KYC manager (manager only)
- Deployer is automatically a manager

**Toggle KYC:**
- `toggle(ticker, account)` - Toggle an account's KYC status (manager only)
  - KYC is per-ticker, so users may need to be verified for each totem

**Check Status:**
- `passedKYC(ticker, account)` - Returns whether an account has passed KYC

**Transfer/mint/burn:**
- The mod will revert if sender or recipient has not passed KYC
- Minter mods are excluded from KYC checks

</details>


### 🟢 Allowlist

A transfer mod that requires holders to approve recipients before transferring to them.

<details>
<summary>Click to see details</summary>

**Approve/Revoke:**
- `toggle(ticker, recipient, allowed)` - Set whether you allow transfers to a recipient
  - Each holder maintains their own allowlist
  - Allowlists are per-ticker

**Check Status:**
- `allowed(ticker, sender, recipient)` - Returns whether sender has approved recipient

**Transfer:**
- The mod will revert if the recipient is not on the sender's allowlist
- Minter mods are excluded from allowlist checks

</details>
