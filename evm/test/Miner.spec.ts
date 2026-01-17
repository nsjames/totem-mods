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

describe("Miner", async () => {
  const { viem, totems, market, accounts, publicClient } = await setupTotemsTest();
  const [creator, miner, otherMiner] = accounts;

  const minerMod = await viem.deployContract("Miner", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, minerMod.address, [Hook.Created, Hook.Transfer], modDetails({ isMinter: true }));

  it("should not be setup before configuration", async () => {
    const isSetup = await minerMod.read.isSetupFor(["MINE"]);
    assert.equal(isSetup, false);
  });

  it("should validate setup with canSetup", async () => {
    // Valid setup
    let [valid, reason] = await minerMod.read.canSetup(["MINE", 100n * 10n ** 18n, 5n]);
    assert.equal(valid, true);
    assert.equal(reason, "");

    // Invalid: totemsPerMine = 0
    [valid, reason] = await minerMod.read.canSetup(["MINE", 0n, 5n]);
    assert.equal(valid, false);
    assert.equal(reason, "totemsPerMine must be greater than zero");

    // Invalid: maxMinesPerDay = 0
    [valid, reason] = await minerMod.read.canSetup(["MINE", 100n * 10n ** 18n, 0n]);
    assert.equal(valid, false);
    assert.equal(reason, "maxMinesPerDay must be greater than zero");
  });

  it("should create totem with miner holding initial supply", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "MINE",
      18,
      [
        { recipient: minerMod.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: miner, amount: 100n * 10n ** 18n }
      ],
      { created: [minerMod.address], transfer: [minerMod.address] }
    );

    const minerModBalance = await getBalance(totems, "MINE", minerMod.address);
    assert.equal(minerModBalance, 10000n * 10n ** 18n);

    // onCreated should have set balances
    const trackedBalance = await minerMod.read.balances(["MINE"]);
    assert.equal(trackedBalance, 10000n * 10n ** 18n);
  });

  it("should allow creator to setup mining parameters", async () => {
    // 100 tokens per mine, max 3 mines per day
    await minerMod.write.setup(["MINE", 100n * 10n ** 18n, 3n], { account: creator });

    const totemsPerMine = await minerMod.read.totemsPerMine(["MINE"]);
    const maxMinesPerDay = await minerMod.read.maxMinesPerDay(["MINE"]);

    assert.equal(totemsPerMine, 100n * 10n ** 18n);
    assert.equal(maxMinesPerDay, 3n);
  });

  it("should be setup after configuration", async () => {
    const isSetup = await minerMod.read.isSetupFor(["MINE"]);
    assert.equal(isSetup, true);
  });

  it("should prevent non-creator from setting up", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "MINEB",
      18,
      [{ recipient: minerMod.address, amount: 1000n * 10n ** 18n, isMinter: true }],
      { created: [minerMod.address], transfer: [minerMod.address] }
    );

    await assert.rejects(async () => {
      await minerMod.write.setup(["MINEB", 100n * 10n ** 18n, 3n], { account: miner });
    });
  });

  it("should allow mining with zero amount parameter", async () => {
    const initialBalance = await getBalance(totems, "MINE", miner);

    // Mine (amount must be 0)
    await mint(totems, minerMod.address, miner, "MINE", 0n);

    const finalBalance = await getBalance(totems, "MINE", miner);
    assert.equal(finalBalance, initialBalance + 100n * 10n ** 18n);

    // Check mine count
    const mineCount = await minerMod.read.userMineCountToday(["MINE", miner]);
    assert.equal(mineCount, 1n);
  });

  it("should reject mining with non-zero amount", async () => {
    await assert.rejects(async () => {
      await mint(totems, minerMod.address, miner, "MINE", 50n * 10n ** 18n);
    }, /Amount must be zero/);
  });

  it("should reject mining with payment", async () => {
    await assert.rejects(async () => {
      await mint(totems, minerMod.address, miner, "MINE", 0n, "", 1000000000000000n); // 0.001 ETH
    }, /Mining is free, no payment required/);
  });

  it("should allow mining up to max mines per day", async () => {
    // Already mined once, can mine 2 more times (max is 3)
    await mint(totems, minerMod.address, miner, "MINE", 0n);
    await mint(totems, minerMod.address, miner, "MINE", 0n);

    const mineCount = await minerMod.read.userMineCountToday(["MINE", miner]);
    assert.equal(mineCount, 3n);

    // Total mined should be 300 tokens
    const balance = await getBalance(totems, "MINE", miner);
    assert.equal(balance, 100n * 10n ** 18n + 300n * 10n ** 18n); // initial 100 + 300 mined
  });

  it("should block mining when daily limit reached", async () => {
    await assert.rejects(async () => {
      await mint(totems, minerMod.address, miner, "MINE", 0n);
    }, /User has reached max mines for today/);
  });

  it("should track different users independently", async () => {
    // otherMiner hasn't mined yet today
    const initialBalance = await getBalance(totems, "MINE", otherMiner);
    assert.equal(initialBalance, 0n);

    await mint(totems, minerMod.address, otherMiner, "MINE", 0n);

    const finalBalance = await getBalance(totems, "MINE", otherMiner);
    assert.equal(finalBalance, 100n * 10n ** 18n);

    const mineCount = await minerMod.read.userMineCountToday(["MINE", otherMiner]);
    assert.equal(mineCount, 1n);
  });

  it("should reset daily limit after day passes", async () => {
    const ONE_DAY = 86400n;

    // Advance time by one day
    await publicClient.request({ method: "evm_increaseTime" as any, params: [Number(ONE_DAY)] });
    await publicClient.request({ method: "evm_mine" as any, params: [] });

    // Miner should be able to mine again
    const initialBalance = await getBalance(totems, "MINE", miner);
    await mint(totems, minerMod.address, miner, "MINE", 0n);

    const finalBalance = await getBalance(totems, "MINE", miner);
    assert.equal(finalBalance, initialBalance + 100n * 10n ** 18n);

    // Mine count should be reset to 1
    const mineCount = await minerMod.read.userMineCountToday(["MINE", miner]);
    assert.equal(mineCount, 1n);
  });

  it("should track balance when tokens are transferred to miner mod", async () => {
    const initialTrackedBalance = await minerMod.read.balances(["MINE"]);

    // Transfer some tokens to the miner mod
    await transfer(totems, "MINE", miner, minerMod.address, 50n * 10n ** 18n);

    const finalTrackedBalance = await minerMod.read.balances(["MINE"]);
    assert.equal(finalTrackedBalance, initialTrackedBalance + 50n * 10n ** 18n);
  });

  it("should reject mining when not enough balance left", async () => {
    // Create a new totem with very limited supply
    await createTotem(
      totems,
      market,
      creator,
      "MINEC",
      18,
      [
        { recipient: minerMod.address, amount: 50n * 10n ** 18n, isMinter: true },
        { recipient: miner, amount: 100n * 10n ** 18n }
      ],
      { created: [minerMod.address], transfer: [minerMod.address] }
    );

    // Setup: 100 tokens per mine, but only 50 available
    await minerMod.write.setup(["MINEC", 100n * 10n ** 18n, 10n], { account: creator });

    await assert.rejects(async () => {
      await mint(totems, minerMod.address, miner, "MINEC", 0n);
    }, /Not enough left to mine/);
  });

  it("should reject setup with invalid parameters", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "MINED",
      18,
      [{ recipient: minerMod.address, amount: 1000n * 10n ** 18n, isMinter: true }],
      { created: [minerMod.address], transfer: [minerMod.address] }
    );

    // totemsPerMine = 0
    await assert.rejects(async () => {
      await minerMod.write.setup(["MINED", 0n, 5n], { account: creator });
    }, /totemsPerMine must be greater than zero/);

    // maxMinesPerDay = 0
    await assert.rejects(async () => {
      await minerMod.write.setup(["MINED", 100n * 10n ** 18n, 0n], { account: creator });
    }, /maxMinesPerDay must be greater than zero/);
  });
});
