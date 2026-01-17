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

describe("ScamDefender", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, recipient, scammer, manager] = accounts;

  const scamDefenderMod = await viem.deployContract("ScamDefender", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, scamDefenderMod.address, [Hook.Transfer]);

  await createTotem(
    totems,
    market,
    creator,
    "SAFE",
    18,
    [{ recipient: holder, amount: 1000n * 10n ** 18n }],
    { transfer: [scamDefenderMod.address] }
  );

  it("should allow transfers to non-flagged addresses", async () => {
    await transfer(totems, "SAFE", holder, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "SAFE", recipient);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should block transfers to flagged scam addresses", async () => {
    await scamDefenderMod.write.toggle(["SAFE", scammer], { account: creator });

    await assert.rejects(async () => {
      await transfer(totems, "SAFE", holder, scammer, 100n * 10n ** 18n);
    }, /flagged for scams/);
  });

  it("should allow flagged addresses to send tokens", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "SAFEB",
      18,
      [{ recipient: scammer, amount: 500n * 10n ** 18n }],
      { transfer: [scamDefenderMod.address] }
    );

    await scamDefenderMod.write.toggle(["SAFEB", scammer], { account: creator });

    await transfer(totems, "SAFEB", scammer, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "SAFEB", recipient);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should allow manager to add other managers", async () => {
    await scamDefenderMod.write.setManager([manager, true], { account: creator });

    const isManager = await scamDefenderMod.read.managers([manager]);
    assert.equal(isManager, true);
  });

  it("should allow new manager to toggle blocklist", async () => {
    await scamDefenderMod.write.toggle(["SAFE", recipient], { account: manager });

    await assert.rejects(async () => {
      await transfer(totems, "SAFE", holder, recipient, 50n * 10n ** 18n);
    }, /flagged for scams/);
  });

  it("should prevent non-managers from toggling blocklist", async () => {
    await assert.rejects(async () => {
      await scamDefenderMod.write.toggle(["SAFE", holder], { account: holder });
    }, /Not a manager/);
  });

  it("should allow manager to remove other managers", async () => {
    await scamDefenderMod.write.setManager([manager, false], { account: creator });

    await assert.rejects(async () => {
      await scamDefenderMod.write.toggle(["SAFE", holder], { account: manager });
    }, /Not a manager/);
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await scamDefenderMod.read.isSetupFor(["SAFE"]);
    assert.equal(isSetup, true);
  });
});
