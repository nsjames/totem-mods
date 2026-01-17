import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  setupTotemsTest,
  publishMod,
  createTotem,
  transfer,
  burn,
  getBalance,
  Hook,
} from "@totems/evm/test/helpers";

describe("Wrapper", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, holder, recipient] = accounts;

  const wrapperMod = await viem.deployContract("Wrapper", [
    totems.address,
    creator
  ]);

  const mockToken = await viem.deployContract("MockERC20", []);

  await publishMod(market, creator, wrapperMod.address, [Hook.Created, Hook.Transfer]);

  it("should not be setup before token is configured", async () => {
    const isSetup = await wrapperMod.read.isSetupFor(["WRAP"]);
    assert.equal(isSetup, false);
  });

  it("should create totem with wrapper holding initial supply and onCreated hook", async () => {
    // Create totem WITH created hook - isSetupFor is only for UI, doesn't affect contract execution
    await createTotem(
      totems,
      market,
      creator,
      "WRAP",
      18,
      [
        { recipient: wrapperMod.address, amount: 10000n * 10n ** 18n },
        { recipient: holder, amount: 500n * 10n ** 18n }
      ],
      { created: [wrapperMod.address], transfer: [wrapperMod.address] }
    );

    const wrapperBalance = await getBalance(totems, "WRAP", wrapperMod.address);
    assert.equal(wrapperBalance, 10000n * 10n ** 18n);

    // onCreated should have set wrappedBalance
    const wrappedBalance = await wrapperMod.read.wrappedBalance(["WRAP"]);
    assert.equal(wrappedBalance, 10000n * 10n ** 18n);
  });

  it("should allow creator to set accepted token", async () => {
    await wrapperMod.write.setAcceptedToken(["WRAP", mockToken.address], { account: creator });

    const acceptedToken = await wrapperMod.read.acceptedToken(["WRAP"]);
    assert.equal(acceptedToken.toLowerCase(), mockToken.address.toLowerCase());
  });

  it("should be setup after token is configured", async () => {
    const isSetup = await wrapperMod.read.isSetupFor(["WRAP"]);
    assert.equal(isSetup, true);
  });

  it("should prevent setting token twice", async () => {
    await assert.rejects(async () => {
      await wrapperMod.write.setAcceptedToken(["WRAP", mockToken.address], { account: creator });
    }, /Token already set/);
  });

  it("should reject setting zero address as token", async () => {
    // Create a new totem to test zero address rejection
    await createTotem(
      totems,
      market,
      creator,
      "WRAPZ",
      18,
      [{ recipient: wrapperMod.address, amount: 1000n * 10n ** 18n }],
      { created: [wrapperMod.address] }
    );

    await assert.rejects(async () => {
      await wrapperMod.write.setAcceptedToken(["WRAPZ", "0x0000000000000000000000000000000000000000"], { account: creator });
    }, /Invalid token address/);
  });

  it("should prevent non-creator from setting accepted token", async () => {
    await createTotem(
      totems,
      market,
      creator,
      "WRAPB",
      18,
      [{ recipient: wrapperMod.address, amount: 1000n * 10n ** 18n }],
      { created: [wrapperMod.address] }
    );

    await assert.rejects(async () => {
      await wrapperMod.write.setAcceptedToken(["WRAPB", mockToken.address], { account: holder });
    });
  });

  it("should reject wrapping when mod not setup (no accepted token)", async () => {
    // WRAPB has no accepted token set
    await assert.rejects(async () => {
      await wrapperMod.write.wrap(["WRAPB", 100n * 10n ** 18n], { account: holder });
    }, /Mod is not setup for this totem/);
  });

  it("should reject wrapping with zero amount", async () => {
    await assert.rejects(async () => {
      await wrapperMod.write.wrap(["WRAP", 0n], { account: holder });
    }, /Amount must be greater than 0/);
  });

  it("should allow wrapping ERC20 for totems", async () => {
    // Mint mock tokens to holder
    await mockToken.write.mint([holder, 1000n * 10n ** 18n]);

    // Approve wrapper to spend holder's tokens
    await mockToken.write.approve([wrapperMod.address, 500n * 10n ** 18n], { account: holder });

    // Wrap tokens
    await wrapperMod.write.wrap(["WRAP", 500n * 10n ** 18n], { account: holder });

    // Check holder now has more wrapped totems
    const totemBalance = await getBalance(totems, "WRAP", holder);
    assert.equal(totemBalance, 1000n * 10n ** 18n); // 500 initial + 500 wrapped

    // Check wrapper received ERC20
    const wrapperErcBalance = await mockToken.read.balanceOf([wrapperMod.address]);
    assert.equal(wrapperErcBalance, 500n * 10n ** 18n);

    // Check wrappedBalance decreased
    const wrappedBalance = await wrapperMod.read.wrappedBalance(["WRAP"]);
    assert.equal(wrappedBalance, 9500n * 10n ** 18n); // 10000 - 500
  });

  it("should allow unwrapping totems for ERC20", async () => {
    // Transfer totems to wrapper (unwrap)
    await transfer(totems, "WRAP", holder, wrapperMod.address, 200n * 10n ** 18n);

    // Check holder received ERC20 back
    const holderErcBalance = await mockToken.read.balanceOf([holder]);
    assert.equal(holderErcBalance, 700n * 10n ** 18n); // 500 remaining + 200 unwrapped

    // Check holder's totem balance decreased
    const totemBalance = await getBalance(totems, "WRAP", holder);
    assert.equal(totemBalance, 800n * 10n ** 18n); // 1000 - 200

    // Check wrappedBalance increased
    const wrappedBalance = await wrapperMod.read.wrappedBalance(["WRAP"]);
    assert.equal(wrappedBalance, 9700n * 10n ** 18n); // 9500 + 200
  });

  it("should reject wrapping more than available wrapped balance", async () => {
    await mockToken.write.approve([wrapperMod.address, 100000n * 10n ** 18n], { account: holder });

    await assert.rejects(async () => {
      await wrapperMod.write.wrap(["WRAP", 100000n * 10n ** 18n], { account: holder });
    }, /Insufficient wrapped balance/);
  });

  it("should not interfere with regular transfers (not to wrapper)", async () => {
    // Transfer from holder to recipient - should work without triggering unwrap
    const holderBalBefore = await getBalance(totems, "WRAP", holder);
    await transfer(totems, "WRAP", holder, recipient, 100n * 10n ** 18n);

    const holderBal = await getBalance(totems, "WRAP", holder);
    const recipientBal = await getBalance(totems, "WRAP", recipient);
    assert.equal(holderBal, holderBalBefore - 100n * 10n ** 18n);
    assert.equal(recipientBal, 100n * 10n ** 18n);
  });

  it("should allow burning wrapped totems", async () => {
    const holderBalBefore = await getBalance(totems, "WRAP", holder);

    // Burn some wrapped totems
    await burn(totems, "WRAP", holder, 50n * 10n ** 18n);

    const holderBalAfter = await getBalance(totems, "WRAP", holder);
    assert.equal(holderBalAfter, holderBalBefore - 50n * 10n ** 18n);
  });

  it("should fail unwrap when no accepted token configured", async () => {
    const wrapperMod2 = await viem.deployContract("Wrapper", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, wrapperMod2.address, [Hook.Created, Hook.Transfer]);

    await createTotem(
      totems,
      market,
      creator,
      "WNOTOKEN",
      18,
      [
        { recipient: wrapperMod2.address, amount: 500n * 10n ** 18n },
        { recipient: holder, amount: 500n * 10n ** 18n }
      ],
      { created: [wrapperMod2.address], transfer: [wrapperMod2.address] }
    );

    // Don't set accepted token

    // Transfer TO wrapper should fail because no accepted token configured
    await assert.rejects(async () => {
      await transfer(totems, "WNOTOKEN", holder, wrapperMod2.address, 100n * 10n ** 18n);
    }, /No accepted token configured/);
  });
});
