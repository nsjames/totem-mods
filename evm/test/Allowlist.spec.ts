import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  setupTotemsTest,
  publishMod,
  createTotem,
  transfer,
  mint,
  getBalance,
  Hook,
  modDetails,
} from "@totems/evm/test/helpers";

describe("Allowlist", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, approved, unapproved] = accounts;

  const allowlistMod = await viem.deployContract("Allowlist", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, allowlistMod.address, [Hook.Transfer]);

  await createTotem(
    totems,
    market,
    creator,
    "ALLOW",
    18,
    [{ recipient: holder, amount: 1000n * 10n ** 18n }],
    { transfer: [allowlistMod.address] }
  );

  it("should block transfers to non-approved addresses by default", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "ALLOW", holder, unapproved, 100n * 10n ** 18n);
    }, /Transfer not allowed by allowlist/);
  });

  it("should allow holder to approve recipients", async () => {
    await allowlistMod.write.toggle(["ALLOW", approved, true], { account: holder });

    const isAllowed = await allowlistMod.read.allowed(["ALLOW", holder, approved]);
    assert.equal(isAllowed, true);
  });

  it("should allow transfers to approved addresses", async () => {
    await transfer(totems, "ALLOW", holder, approved, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "ALLOW", approved);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should still block transfers to unapproved addresses", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "ALLOW", holder, unapproved, 100n * 10n ** 18n);
    }, /Transfer not allowed by allowlist/);
  });

  it("should allow holder to revoke approval", async () => {
    await allowlistMod.write.toggle(["ALLOW", approved, false], { account: holder });

    await assert.rejects(async () => {
      await transfer(totems, "ALLOW", holder, approved, 100n * 10n ** 18n);
    }, /Transfer not allowed by allowlist/);
  });

  it("should have per-sender allowlists", async () => {
    await allowlistMod.write.toggle(["ALLOW", holder, true], { account: approved });

    await transfer(totems, "ALLOW", approved, holder, 50n * 10n ** 18n);

    const balance = await getBalance(totems, "ALLOW", holder);
    assert.equal(balance, 950n * 10n ** 18n);
  });

  it("should maintain separate allowlists per ticker", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "ALLOWB",
      18,
      [{ recipient: holder, amount: 500n * 10n ** 18n }],
      { transfer: [allowlistMod.address] }
    );

    await assert.rejects(async () => {
      await transfer(totems, "ALLOWB", holder, approved, 100n * 10n ** 18n);
    }, /Transfer not allowed by allowlist/);

    await allowlistMod.write.toggle(["ALLOWB", approved, true], { account: holder });
    await transfer(totems, "ALLOWB", holder, approved, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "ALLOWB", approved);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await allowlistMod.read.isSetupFor(["ALLOW"]);
    assert.equal(isSetup, true);
  });

  it("should exclude minter mods from allowlist rules", async () => {
    // Deploy a minter mod
    const minterMod = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, minterMod.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create totem with allowlist mod and minter
    await createTotem(
      totems,
      market,
      creator,
      "ALLOWC",
      18,
      [
        { recipient: minterMod.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: holder, amount: 100n * 10n ** 18n }
      ],
      { transfer: [allowlistMod.address], mint: [minterMod.address] }
    );

    // Holder has NOT approved the minter on the allowlist
    // But minting should still work because minter mods are excluded
    const initialBalance = await getBalance(totems, "ALLOWC", holder);
    await mint(totems, minterMod.address, holder, "ALLOWC", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "ALLOWC", holder);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Transfer TO minter mod should also work without being on allowlist
    await transfer(totems, "ALLOWC", holder, minterMod.address, 10n * 10n ** 18n);
  });
});
