import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "Allowlist",
    hooks: [Hook.Transfer],
    price: 0n,
    details: {
        name: "Allowlist",
        summary: "Require holders to approve recipients before transferring to them.",
        markdown: `## Allowlist Mod

Requires token holders to explicitly approve recipients before they can transfer tokens to them.

### User Functions
- \`toggle(ticker, recipient, allowed)\` - Set whether you allow transfers to a recipient

### View Functions
- \`allowed(ticker, sender, recipient)\` - Check if sender has approved recipient

### Notes
- Each holder maintains their own allowlist
- Allowlists are per-ticker
- Minter mods are excluded from allowlist checks`,
        image: "bafkreigyzuampck6rqkuvfqgkqltdn2b43vdbv327mmwc75vi2qtqf4na4",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/allowlist/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
