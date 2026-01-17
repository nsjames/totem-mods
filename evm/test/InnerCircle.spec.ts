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

describe("InnerCircle", async () => {
  const { viem, totems, market, accounts } = await setupTotemsTest();
  const [creator, memberA, memberB, outsider, memberC] = accounts;

  const innerCircleMod = await viem.deployContract("InnerCircle", [
    totems.address,
    creator
  ]);

  await publishMod(market, creator, innerCircleMod.address, [Hook.Transfer, Hook.Burn, Hook.Mint]);

  await createTotem(
    totems,
    market,
    creator,
    "CIRCLE",
    18,
    [
      { recipient: creator, amount: 1000n * 10n ** 18n },
      { recipient: memberA, amount: 500n * 10n ** 18n },
      { recipient: outsider, amount: 500n * 10n ** 18n }
    ],
    { transfer: [innerCircleMod.address], burn: [innerCircleMod.address] }
  );

  // Add memberA to the inner circle
  await innerCircleMod.write.addMember(["CIRCLE", memberA], { account: creator });

  it("should always report as setup for any ticker", async () => {
    const isSetup = await innerCircleMod.read.isSetupFor(["CIRCLE"]);
    assert.equal(isSetup, true);
  });

  it("should recognize creator as member without explicit membership", async () => {
    const isMember = await innerCircleMod.read.isMember(["CIRCLE", creator]);
    assert.equal(isMember, true);
  });

  it("should allow creator to add members", async () => {
    const isMember = await innerCircleMod.read.isMember(["CIRCLE", memberA]);
    assert.equal(isMember, true);
  });

  it("should track member count correctly", async () => {
    const count = await innerCircleMod.read.memberCount(["CIRCLE"]);
    assert.equal(count, 1n); // memberA only, creator is implicit
  });

  it("should block transfers from non-members", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "CIRCLE", outsider, memberA, 50n * 10n ** 18n);
    }, /Sender is not a member/);
  });

  it("should block transfers to non-members", async () => {
    await assert.rejects(async () => {
      await transfer(totems, "CIRCLE", memberA, outsider, 50n * 10n ** 18n);
    }, /Recipient is not a member/);
  });

  it("should allow transfers between members", async () => {
    await transfer(totems, "CIRCLE", memberA, creator, 50n * 10n ** 18n);

    const balance = await getBalance(totems, "CIRCLE", creator);
    assert.equal(balance, 1050n * 10n ** 18n);
  });

  it("should allow transfers from creator (implicit member)", async () => {
    const initialBalance = await getBalance(totems, "CIRCLE", memberA);
    await transfer(totems, "CIRCLE", creator, memberA, 100n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "CIRCLE", memberA);
    assert.equal(finalBalance, initialBalance + 100n * 10n ** 18n);
  });

  it("should allow existing members to sponsor new members", async () => {
    await innerCircleMod.write.addMember(["CIRCLE", memberB], { account: memberA });

    const isMember = await innerCircleMod.read.isMember(["CIRCLE", memberB]);
    assert.equal(isMember, true);

    const count = await innerCircleMod.read.memberCount(["CIRCLE"]);
    assert.equal(count, 2n);
  });

  it("should prevent non-members from sponsoring", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.addMember(["CIRCLE", outsider], { account: outsider });
    }, /Only members can sponsor new members/);
  });

  it("should prevent adding existing members", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.addMember(["CIRCLE", memberA], { account: creator });
    }, /Already a member/);
  });

  it("should block burns from non-members", async () => {
    await assert.rejects(async () => {
      await burn(totems, "CIRCLE", outsider, 50n * 10n ** 18n);
    }, /Owner is not a member/);
  });

  it("should allow burns from members", async () => {
    const initialBalance = await getBalance(totems, "CIRCLE", memberA);
    await burn(totems, "CIRCLE", memberA, 10n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "CIRCLE", memberA);
    assert.equal(finalBalance, initialBalance - 10n * 10n ** 18n);
  });

  // Voting tests
  it("should allow members to vote to remove another member", async () => {
    // Add memberC so we have enough voters
    await innerCircleMod.write.addMember(["CIRCLE", memberC], { account: creator });

    // memberA votes to remove memberB
    await innerCircleMod.write.voteToRemove(["CIRCLE", memberB], { account: memberA });

    const voteCount = await innerCircleMod.read.removalVoteCount(["CIRCLE", memberB]);
    assert.equal(voteCount, 1n);

    const hasVoted = await innerCircleMod.read.removalVotes(["CIRCLE", memberB, memberA]);
    assert.equal(hasVoted, true);
  });

  it("should prevent double voting", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.voteToRemove(["CIRCLE", memberB], { account: memberA });
    }, /Already voted/);
  });

  it("should prevent non-members from voting", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.voteToRemove(["CIRCLE", memberB], { account: outsider });
    }, /Only members can vote/);
  });

  it("should prevent voting on non-members", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.voteToRemove(["CIRCLE", outsider], { account: memberA });
    }, /Target is not a member/);
  });

  it("should prevent voting on your own removal", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.voteToRemove(["CIRCLE", memberA], { account: memberA });
    }, /Cannot vote on your own removal/);
  });

  it("should prevent voting to remove the creator", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.voteToRemove(["CIRCLE", creator], { account: memberA });
    }, /Cannot vote to remove the creator/);
  });

  it("should allow retracting votes", async () => {
    await innerCircleMod.write.retractVote(["CIRCLE", memberB], { account: memberA });

    const voteCount = await innerCircleMod.read.removalVoteCount(["CIRCLE", memberB]);
    assert.equal(voteCount, 0n);

    const hasVoted = await innerCircleMod.read.removalVotes(["CIRCLE", memberB, memberA]);
    assert.equal(hasVoted, false);
  });

  it("should prevent retracting non-existent votes", async () => {
    await assert.rejects(async () => {
      await innerCircleMod.write.retractVote(["CIRCLE", memberB], { account: memberC });
    }, /No vote to retract/);
  });

  it("should auto-remove member when majority votes reached", async () => {
    // Current members: memberA, memberB, memberC (3 members)
    // To remove memberB, we need >50% of 2 eligible voters (excluding memberB)
    // That means we need 2 votes (2/2 = 100% > 50%)

    // memberA votes
    await innerCircleMod.write.voteToRemove(["CIRCLE", memberB], { account: memberA });

    // memberB should still be a member (1/2 = 50%, not >50%)
    let isMember = await innerCircleMod.read.isMember(["CIRCLE", memberB]);
    assert.equal(isMember, true);

    // memberC votes - this should trigger removal (2/2 = 100% > 50%)
    await innerCircleMod.write.voteToRemove(["CIRCLE", memberB], { account: memberC });

    // memberB should now be removed
    isMember = await innerCircleMod.read.isMember(["CIRCLE", memberB]);
    assert.equal(isMember, false);

    // Member count should decrease
    const count = await innerCircleMod.read.memberCount(["CIRCLE"]);
    assert.equal(count, 2n); // memberA and memberC remain
  });

  it("should block transfers after member is removed by vote", async () => {
    // Give memberB some tokens via creator first (need to re-add them)
    // memberB is no longer a member, so transfers should fail
    await assert.rejects(async () => {
      await transfer(totems, "CIRCLE", creator, memberB, 10n * 10n ** 18n);
    }, /Recipient is not a member/);
  });

  it("should allow transfers to the contract itself (excluded)", async () => {
    // Create a new totem where we can test transfers to the contract
    await createTotem(
      totems,
      market,
      creator,
      "CIRCLEC",
      18,
      [
        { recipient: memberA, amount: 500n * 10n ** 18n }
      ],
      { transfer: [innerCircleMod.address] }
    );

    // Add memberA to inner circle for CIRCLEC
    await innerCircleMod.write.addMember(["CIRCLEC", memberA], { account: creator });

    // Transfer to the contract itself should work (contract is excluded)
    await transfer(totems, "CIRCLEC", memberA, innerCircleMod.address, 10n * 10n ** 18n);

    const contractBalance = await getBalance(totems, "CIRCLEC", innerCircleMod.address);
    assert.equal(contractBalance, 10n * 10n ** 18n);
  });

  // Minter exclusion tests
  it("should exclude minter mods from inner circle rules", async () => {
    // Deploy a minter mod
    const minterMod = await viem.deployContract("UnlimitedMinterMod", [
      totems.address,
      creator
    ]);
    await publishMod(market, creator, minterMod.address, [Hook.Mint], modDetails({ isMinter: true }));

    // Create totem with inner circle mod and minter
    await createTotem(
      totems,
      market,
      creator,
      "CIRCLEB",
      18,
      [
        { recipient: minterMod.address, amount: 10000n * 10n ** 18n, isMinter: true },
        { recipient: memberA, amount: 100n * 10n ** 18n }
      ],
      { transfer: [innerCircleMod.address], mint: [innerCircleMod.address, minterMod.address] }
    );

    // Add memberA to inner circle for CIRCLEB
    await innerCircleMod.write.addMember(["CIRCLEB", memberA], { account: creator });

    // Minting should work even though minter is not a member (minters excluded)
    const initialBalance = await getBalance(totems, "CIRCLEB", memberA);
    await mint(totems, minterMod.address, memberA, "CIRCLEB", 50n * 10n ** 18n);

    const finalBalance = await getBalance(totems, "CIRCLEB", memberA);
    assert.equal(finalBalance, initialBalance + 50n * 10n ** 18n);

    // Transfer TO minter mod should also work (minters excluded)
    await transfer(totems, "CIRCLEB", memberA, minterMod.address, 10n * 10n ** 18n);
  });
});
