import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  setupTotemsTest,
  publishMod,
  createTotem,
  transfer,
  getBalance,
  Hook,
} from "@totems/evm/test/helpers";

const ONE_DAY = 86400n;
const ONE_WEEK = 604800n;

describe("TransferControls", async () => {
  const { viem, totems, market, accounts, publicClient } = await setupTotemsTest();
  const [creator, holder, recipient] = accounts;

  const transferControlsMod = await viem.deployContract("TransferControls", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, transferControlsMod.address, [Hook.Transfer]);

  await createTotem(
    totems,
    market,
    creator,
    "LIMIT",
    18,
    [{ recipient: holder, amount: 10000n * 10n ** 18n }],
    { transfer: [transferControlsMod.address] }
  );

  it("should allow unlimited transfers when no limits are set", async () => {
    await transfer(totems, "LIMIT", holder, recipient, 1000n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMIT", recipient);
    assert.equal(balance, 1000n * 10n ** 18n);
  });

  it("should allow user to set their own daily limit", async () => {
    const dailyLimit = 500n * 10n ** 18n;
    const weeklyLimit = 0n;

    await transferControlsMod.write.setLimits(["LIMIT", dailyLimit, weeklyLimit], { account: holder });

    const limits = await transferControlsMod.read.limits(["LIMIT", holder]);
    assert.equal(limits[0], dailyLimit);
  });

  it("should allow transfers within daily limit", async () => {
    await transfer(totems, "LIMIT", holder, recipient, 200n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMIT", recipient);
    assert.equal(balance, 1200n * 10n ** 18n);
  });

  it("should block transfers exceeding daily limit", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "LIMIT", holder, recipient, 400n * 10n ** 18n);
    }, /Daily transfer limit exceeded/);
  });

  it("should allow user to set weekly limit", async () => {
    // Set high daily limit so weekly is the constraint
    const dailyLimit = 2000n * 10n ** 18n;
    const weeklyLimit = 500n * 10n ** 18n;

    await transferControlsMod.write.setLimits(["LIMIT", dailyLimit, weeklyLimit], { account: holder });

    const limits = await transferControlsMod.read.limits(["LIMIT", holder]);
    assert.equal(limits[1], weeklyLimit);
  });

  it("should track weekly totals", async () => {
    await transfer(totems, "LIMIT", holder, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMIT", recipient);
    assert.equal(balance, 1300n * 10n ** 18n);
  });

  it("should block transfers exceeding weekly limit", async () => {
    // Weekly total is now 100, trying to add 500 would exceed 500 limit
    await assert.rejects(async () => {
      await transfer(totems, "LIMIT", holder, recipient, 500n * 10n ** 18n);
    }, /Weekly transfer limit exceeded/);
  });

  it("should allow transfers up to the remaining weekly limit", async () => {
    // Weekly total is 100, can add 400 more to reach 500
    await transfer(totems, "LIMIT", holder, recipient, 400n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMIT", recipient);
    assert.equal(balance, 1700n * 10n ** 18n);
  });

  it("should not affect users who have not set limits", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "LIMITB",
      18,
      [{ recipient: recipient, amount: 5000n * 10n ** 18n }],
      { transfer: [transferControlsMod.address] }
    );

    await transfer(totems, "LIMITB", recipient, holder, 5000n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMITB", holder);
    assert.equal(balance, 5000n * 10n ** 18n);
  });

  it("should reset daily limit after a day passes", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "LIMITC",
      18,
      [{ recipient: holder, amount: 10000n * 10n ** 18n }],
      { transfer: [transferControlsMod.address] }
    );

    // Set daily limit
    await transferControlsMod.write.setLimits(["LIMITC", 100n * 10n ** 18n, 0n], { account: holder });

    // Use up the daily limit
    await transfer(totems, "LIMITC", holder, recipient, 100n * 10n ** 18n);

    // Should fail - daily limit reached
    await assert.rejects(async () => {
      await transfer(totems, "LIMITC", holder, recipient, 1n);
    }, /Daily transfer limit exceeded/);

    // Advance time by 1 day
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [Number(ONE_DAY)],
    });
    await publicClient.request({
      method: "evm_mine" as any,
      params: [],
    });

    // Should work now - daily limit reset
    await transfer(totems, "LIMITC", holder, recipient, 50n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMITC", recipient);
    assert.equal(balance, 150n * 10n ** 18n);
  });

  it("should reset weekly limit after a week passes", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "LIMITD",
      18,
      [{ recipient: holder, amount: 10000n * 10n ** 18n }],
      { transfer: [transferControlsMod.address] }
    );

    // Set weekly limit (high daily so weekly is the constraint)
    await transferControlsMod.write.setLimits(["LIMITD", 1000n * 10n ** 18n, 200n * 10n ** 18n], { account: holder });

    // Use up the weekly limit
    await transfer(totems, "LIMITD", holder, recipient, 200n * 10n ** 18n);

    // Should fail - weekly limit reached
    await assert.rejects(async () => {
      await transfer(totems, "LIMITD", holder, recipient, 1n);
    }, /Weekly transfer limit exceeded/);

    // Advance time by 1 week
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [Number(ONE_WEEK)],
    });
    await publicClient.request({
      method: "evm_mine" as any,
      params: [],
    });

    // Should work now - weekly limit reset
    await transfer(totems, "LIMITD", holder, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "LIMITD", recipient);
    assert.equal(balance, 300n * 10n ** 18n);
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await transferControlsMod.read.isSetupFor(["LIMIT"]);
    assert.equal(isSetup, true);
  });
});
