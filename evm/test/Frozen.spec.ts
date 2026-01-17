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

describe("Freezer", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, recipient] = accounts;

  // Deploy and publish the mod
  const freezerMod = await viem.deployContract("Freezer", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, freezerMod.address, [Hook.Transfer]);

  // Create a totem using the mod
  await createTotem(
      totems,
      market,
      creator,
      "FREEZE",
      18,
      [{ recipient: holder, amount: 1000n * 10n ** 18n }],
      { transfer: [freezerMod.address] }
  );

  it("should allow transfers when not frozen", async () => {
    await transfer(totems, "FREEZE", holder, recipient, 100n * 10n ** 18n);

    const balance = await getBalance(totems, "FREEZE", recipient);
    assert.equal(balance, 100n * 10n ** 18n);
  });

  it("should block transfers when frozen", async () => {
    // Freeze transfers (called by creator)
    await freezerMod.write.toggle(["FREEZE"], { account: creator });

    await assert.rejects(async () => {
      await transfer(totems, "FREEZE", holder, recipient, 100n * 10n ** 18n);
    }, /Transfers are frozen/);
  });

  it("should allow transfers after unfreezing", async () => {
    // Unfreeze transfers (toggle again)
    await freezerMod.write.toggle(["FREEZE"], { account: creator });

    await transfer(totems, "FREEZE", holder, recipient, 50n * 10n ** 18n);

    const balance = await getBalance(totems, "FREEZE", recipient);
    assert.equal(balance, 150n * 10n ** 18n);
  });

  it("should only allow creator to toggle freeze", async () => {
    await assert.rejects(async () => {
      await freezerMod.write.toggle(["FREEZE"], { account: holder });
    });
  });

  it("should track frozen state correctly", async () => {
    const isFrozen = await freezerMod.read.isFrozen(["FREEZE"]);
    assert.equal(isFrozen, false);

    await freezerMod.write.toggle(["FREEZE"], { account: creator });

    const isFrozenAfter = await freezerMod.read.isFrozen(["FREEZE"]);
    assert.equal(isFrozenAfter, true);
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await freezerMod.read.isSetupFor(["FREEZE"]);
    assert.equal(isSetup, true);
  });
});