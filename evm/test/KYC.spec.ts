import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  setupTotemsTest,
  publishMod,
  createTotem,
  transfer,
  burn,
  mint,
  getBalance,
  Hook,
  modDetails,
} from "@totems/evm/test/helpers";

describe("KYC", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, recipient, unverified] = accounts;

  const kycMod = await viem.deployContract("KYC", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, kycMod.address, [Hook.Transfer, Hook.Burn, Hook.Mint]);

  // Pre-verify holder and recipient for KYC
  await kycMod.write.toggle(["KYC", holder], { account: creator });
  await kycMod.write.toggle(["KYC", recipient], { account: creator });

  await createTotem(
    totems,
    market,
    creator,
    "KYC",
    18,
    [
      { recipient: holder, amount: 500n * 10n ** 18n },
      { recipient: unverified, amount: 500n * 10n ** 18n }
    ],
    { transfer: [kycMod.address], burn: [kycMod.address] }
  );

  it("should allow transfers between KYC-verified addresses", async () => {
    await transfer(totems, "KYC", holder, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "KYC", recipient);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should block transfers from non-KYC sender", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "KYC", unverified, recipient, 100n * 10n ** 18n);
    }, /Sender has not passed KYC/);
  });

  it("should block transfers to non-KYC recipient", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "KYC", holder, unverified, 100n * 10n ** 18n);
    }, /Recipient has not passed KYC/);
  });

  it("should allow transfers after passing KYC", async () => {
    // Verify the previously unverified user
    await kycMod.write.toggle(["KYC", unverified], { account: creator });

    await transfer(totems, "KYC", unverified, recipient, 50n * 10n ** 18n);

    const balance = await getBalance(totems, "KYC", recipient);
    assert.equal(balance, 150n * 10n ** 18n);
  });

  it("should block transfers after KYC is revoked", async () => {
    // Revoke KYC for the user
    await kycMod.write.toggle(["KYC", unverified], { account: creator });

    await assert.rejects(async () => {
      await transfer(totems, "KYC", unverified, recipient, 50n * 10n ** 18n);
    }, /Sender has not passed KYC/);
  });

  it("should block burns from non-KYC address", async () => {
    await assert.rejects(async () => {
      await burn(totems, "KYC", unverified, 100n * 10n ** 18n);
    }, /Owner has not passed KYC/);
  });

  it("should allow burns from KYC-verified address", async () => {
    const initialBalance = await getBalance(totems, "KYC", holder);
    await burn(totems, "KYC", holder, 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "KYC", holder);
    assert.equal(finalBalance, initialBalance - 50n * 10n ** 18n);
  });

  it("should only allow managers to toggle KYC status", async () => {
    await assert.rejects(async () => {
      await kycMod.write.toggle(["KYC", recipient], { account: holder });
    }, /Not a KYC manager/);
  });

  it("should allow managers to add other managers", async () => {
    // Add holder as a manager
    await kycMod.write.setManager([holder, true], { account: creator });

    // Now holder can toggle KYC
    await kycMod.write.toggle(["KYC", unverified], { account: holder });

    const isVerified = await kycMod.read.passedKYC(["KYC", unverified]);
    assert.equal(isVerified, true);
  });

  it("should allow managers to remove other managers", async () => {
    // Remove holder as a manager
    await kycMod.write.setManager([holder, false], { account: creator });

    // Now holder can no longer toggle KYC
    await assert.rejects(async () => {
      await kycMod.write.toggle(["KYC", unverified], { account: holder });
    }, /Not a KYC manager/);
  });

  it("should prevent non-managers from adding managers", async () => {
    await assert.rejects(async () => {
      await kycMod.write.setManager([unverified, true], { account: holder });
    }, /Not a KYC manager/);
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await kycMod.read.isSetupFor(["KYC"]);
    assert.equal(isSetup, true);
  });

  // Minting tests with UnlimitedMinterMod
  it("should allow minting for KYC-verified addresses and block non-KYC", async () => {
    // Deploy the unlimited minter mod
    const minterMod = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, minterMod.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create a new totem with minter and KYC as mint hook observer
    await createTotem(
      totems,
      market,
      creator,
      "KYCMINT",
      18,
      [
        { recipient: minterMod.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: holder, amount: 100n * 10n ** 18n },
        { recipient: unverified, amount: 100n * 10n ** 18n }
      ],
      { mint: [kycMod.address, minterMod.address] }
    );

    // Verify holder for this ticker
    await kycMod.write.toggle(["KYCMINT", holder], { account: creator });

    const initialBalance = await getBalance(totems, "KYCMINT", holder);

    // Mint to KYC-verified address should succeed
    await mint(totems, minterMod.address, holder, "KYCMINT", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "KYCMINT", holder);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Mint to non-KYC address should fail
    await assert.rejects(async () => {
      await mint(totems, minterMod.address, unverified, "KYCMINT", 50n * 10n ** 18n);
    }, /Minter has not passed KYC/);
  });

  it("should exclude minter mods from KYC rules", async () => {
    // Deploy a new minter mod
    const minterMod2 = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, minterMod2.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create totem with KYC mod and minter - minter is NOT KYC verified
    await createTotem(
      totems,
      market,
      creator,
      "KYCEXCL",
      18,
      [
        { recipient: minterMod2.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: holder, amount: 100n * 10n ** 18n }
      ],
      { transfer: [kycMod.address], mint: [kycMod.address, minterMod2.address] }
    );

    // Verify holder for this ticker
    await kycMod.write.toggle(["KYCEXCL", holder], { account: creator });

    // Minting should work because minter mods are excluded from KYC
    // (minterMod2 is not KYC verified but is a minter)
    const initialBalance = await getBalance(totems, "KYCEXCL", holder);
    await mint(totems, minterMod2.address, holder, "KYCEXCL", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "KYCEXCL", holder);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Transfer TO minter mod should also work (minter excluded from recipient KYC check)
    await transfer(totems, "KYCEXCL", holder, minterMod2.address, 10n * 10n ** 18n);
  });
});
