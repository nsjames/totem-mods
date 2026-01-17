import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  setupTotemsTest,
  publishMod,
  createTotem,
  burn,
  getBalance,
  Hook,
} from "@totems/evm/test/helpers";

describe("Extinguisher", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder] = accounts;

  const extinguisherMod = await viem.deployContract("Extinguisher", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, extinguisherMod.address, [Hook.Burn]);

  await createTotem(
    totems,
    market,
    creator,
    "NOBURN",
    18,
    [{ recipient: holder, amount: 1000n * 10n ** 18n }],
    { burn: [extinguisherMod.address] }
  );

  it("should block all burn attempts", async () => {
    const initialBalance = await getBalance(totems, "NOBURN", holder);
    assert.equal(initialBalance, 1000n * 10n ** 18n);

    await assert.rejects(async () => {
      await burn(totems, "NOBURN", holder, 100n * 10n ** 18n);
    }, /This totem cannot be burned/);

    const finalBalance = await getBalance(totems, "NOBURN", holder);
    assert.equal(finalBalance, 1000n * 10n ** 18n);
  });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await extinguisherMod.read.isSetupFor(["NOBURN"]);
    assert.equal(isSetup, true);

    const isSetupOther = await extinguisherMod.read.isSetupFor(["OTHER"]);
    assert.equal(isSetupOther, true);
  });
});
