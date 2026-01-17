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

describe("Blocklist", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, recipient, blocked] = accounts;

  const blocklistMod = await viem.deployContract("Blocklist", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, blocklistMod.address, [Hook.Transfer, Hook.Burn, Hook.Mint]);

  await createTotem(
    totems,
    market,
    creator,
    "BLOCK",
    18,
    [
      { recipient: holder, amount: 500n * 10n ** 18n },
      { recipient: blocked, amount: 500n * 10n ** 18n }
    ],
    { transfer: [blocklistMod.address], burn: [blocklistMod.address] }
  );

  it("should allow transfers between non-blocked addresses", async () => {
    await transfer(totems, "BLOCK", holder, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "BLOCK", recipient);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should block transfers from blocklisted sender", async () => {
    await blocklistMod.write.toggle(["BLOCK", blocked], { account: creator });

    await assert.rejects(async () => {
      await transfer(totems, "BLOCK", blocked, recipient, 100n * 10n ** 18n);
    }, /Sender is blocklisted/);
  });

  it("should block transfers to blocklisted recipient", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "BLOCK", holder, blocked, 100n * 10n ** 18n);
    }, /Recipient is blocklisted/);
  });

  it("should allow transfers after removing from blocklist", async () => {
    await blocklistMod.write.toggle(["BLOCK", blocked], { account: creator });

    await transfer(totems, "BLOCK", blocked, recipient, 50n * 10n ** 18n);

    const balance = await getBalance(totems, "BLOCK", recipient);
    assert.equal(balance, 150n * 10n ** 18n);
  });

  it("should block burns from blocklisted address", async () => {
    await blocklistMod.write.toggle(["BLOCK", blocked], { account: creator });

    await assert.rejects(async () => {
      await burn(totems, "BLOCK", blocked, 100n * 10n ** 18n);
    }, /Owner is blocklisted/);
  });

  it("should allow burns from non-blocklisted address", async () => {
    const initialBalance = await getBalance(totems, "BLOCK", holder);
    await burn(totems, "BLOCK", holder, 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "BLOCK", holder);
    assert.equal(finalBalance, initialBalance - 50n * 10n ** 18n);
  });

  it("should only allow creator to toggle blocklist", async () => {
    await assert.rejects(async () => {
      await blocklistMod.write.toggle(["BLOCK", recipient], { account: holder });
    });
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await blocklistMod.read.isSetupFor(["BLOCK"]);
    assert.equal(isSetup, true);
  });

  // Minting tests with UnlimitedMinterMod
  it("should allow minting for non-blocked addresses and block minting for blocklisted", async () => {
    // Deploy the unlimited minter mod
    const minterMod = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    // Publish as a minter mod
    await publishMod(market, creator, minterMod.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create a new totem with minter allocation and blocklist as mint hook observer
    await createTotem(
      totems,
      market,
      creator,
      "BMINT",
      18,
      [
        { recipient: minterMod.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: holder, amount: 100n * 10n ** 18n },
        { recipient: blocked, amount: 100n * 10n ** 18n }
      ],
      { mint: [blocklistMod.address, minterMod.address] }
    );

    const initialBalance = await getBalance(totems, "BMINT", holder);

    // Mint to non-blocked address should succeed
    await mint(totems, minterMod.address, holder, "BMINT", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "BMINT", holder);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Now block an address and try to mint to them
    await blocklistMod.write.toggle(["BMINT", blocked], { account: creator });

    // Mint to blocked address should fail
    await assert.rejects(async () => {
      await mint(totems, minterMod.address, blocked, "BMINT", 50n * 10n ** 18n);
    }, /Minter is blocklisted/);
  });

  it("should exclude minter mods from blocklist rules", async () => {
    // Deploy a new minter mod
    const minterMod2 = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, minterMod2.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create totem with blocklist mod and minter
    await createTotem(
      totems,
      market,
      creator,
      "BEXCL",
      18,
      [
        { recipient: minterMod2.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: holder, amount: 100n * 10n ** 18n }
      ],
      { transfer: [blocklistMod.address], mint: [blocklistMod.address, minterMod2.address] }
    );

    // Block the minter mod
    await blocklistMod.write.toggle(["BEXCL", minterMod2.address], { account: creator });

    // Minting should still work because minter mods are excluded from blocklist
    const initialBalance = await getBalance(totems, "BEXCL", holder);
    await mint(totems, minterMod2.address, holder, "BEXCL", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "BEXCL", holder);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Transfer TO minter mod should also work (for depositing tokens)
    await transfer(totems, "BEXCL", holder, minterMod2.address, 10n * 10n ** 18n);
  });
});
