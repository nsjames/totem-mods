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

describe("WhaleBlock", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, recipient] = accounts;

  const whaleBlockMod = await viem.deployContract("WhaleBlock", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, whaleBlockMod.address, [Hook.Transfer]);

  await createTotem(
    totems,
    market,
    creator,
    "WHALE",
    18,
    [{ recipient: holder, amount: 10000n * 10n ** 18n }],
    { transfer: [whaleBlockMod.address] }
  );

  it("should allow unlimited transfers when not configured", async () => {
    await transfer(totems, "WHALE", holder, recipient, 5000n * 10n ** 18n);

    const balance = await getBalance(totems, "WHALE", recipient);
    assert.equal(balance, 5000n * 10n ** 18n);
  });

  it("should allow creator to configure max percentage", async () => {
    await whaleBlockMod.write.configure(["WHALE", 60], { account: creator });

    const maxPercentage = await whaleBlockMod.read.maxTokenPercentage(["WHALE"]);
    assert.equal(maxPercentage, 60);
  });

  it("should block transfers that would exceed the percentage limit", async () => {
    // recipient has 5000 (50%), limit is 60% (6000)
    // trying to add 1500 would put them at 6500 (65%)
    await assert.rejects(async () => {
      await transfer(totems, "WHALE", holder, recipient, 1500n * 10n ** 18n);
    }, /No whales allowed!/);
  });

  it("should allow transfers within the percentage limit", async () => {
    // recipient has 5000, can receive 1000 more (to reach 6000 = 60%)
    await transfer(totems, "WHALE", holder, recipient, 500n * 10n ** 18n);

    const balance = await getBalance(totems, "WHALE", recipient);
    assert.equal(balance, 5500n * 10n ** 18n);
  });

  it("should prevent non-creator from configuring", async () => {
    await assert.rejects(async () => {
      await whaleBlockMod.write.configure(["WHALE", 80], { account: holder });
    });
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await whaleBlockMod.read.isSetupFor(["WHALE"]);
    assert.equal(isSetup, true);
  });

  it("should exclude minter mods from whale block rules", async () => {
    // Deploy a minter mod
    const minterMod = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, minterMod.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create totem with whale block mod and a strict 10% limit
    await createTotem(
      totems,
      market,
      creator,
      "WHALEB",
      18,
      [
        { recipient: minterMod.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: holder, amount: 1000n * 10n ** 18n }
      ],
      { transfer: [whaleBlockMod.address], mint: [minterMod.address] }
    );

    // Configure a strict 10% whale limit
    await whaleBlockMod.write.configure(["WHALEB", 10], { account: creator });

    // Minter already has 10000 tokens (90.9% of supply)
    // But minting should still work because minter mods are excluded from whale checks
    const initialBalance = await getBalance(totems, "WHALEB", holder);
    await mint(totems, minterMod.address, holder, "WHALEB", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "WHALEB", holder);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Transfer TO minter mod should also work without whale restrictions
    await transfer(totems, "WHALEB", holder, minterMod.address, 100n * 10n ** 18n);

    // Verify minter has received tokens (would have been blocked if not excluded)
    // Minter started with 10000, gave 50 via mint, received 100 = 10050
    const minterBalance = await getBalance(totems, "WHALEB", minterMod.address);
    assert.equal(minterBalance, 10000n * 10n ** 18n - 50n * 10n ** 18n + 100n * 10n ** 18n);
  });
});
