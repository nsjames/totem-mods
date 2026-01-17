import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "InnerCircle",
    hooks: [Hook.Mint, Hook.Burn, Hook.Transfer],
    price: 0n,
    details: {
        name: "Inner Circle",
        summary: "Restrict token operations to members only with vote-based removal.",
        markdown: `## Inner Circle Mod

Restricts token operations (transfer, mint, burn) to approved members only.

### Membership
- The totem creator is always a member (implicit)
- Creator can add anyone as a member
- Existing members can sponsor new members

### Adding Members
- \`addMember(ticker, account)\` - Add a new member

### Vote-Based Removal
- \`voteToRemove(ticker, target)\` - Cast a vote to remove a member
- \`retractVote(ticker, target)\` - Retract your removal vote
- Member is auto-removed when >50% of eligible voters vote
- Cannot vote to remove the creator

### Notes
- Minter mods are excluded from membership checks
- Non-members cannot send, receive, mint, or burn tokens`,
        image: "bafkreifnsmdfyqrqyrhc2lmeeweottqpa6yypbj5tee3mzyaayzqdecdfa",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/inner-circle/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
