import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "TransferControls",
    hooks: [Hook.Transfer],
    price: 0n,
    details: {
        name: "Transfer Controls",
        summary: "Allow holders to set their own daily and weekly transfer limits.",
        markdown: `## Transfer Controls Mod

Enables token holders to set personal transfer limits for themselves.

### User Functions
- \`setLimits(ticker, dailyLimit, weeklyLimit)\` - Set your own transfer limits

### View Functions
- \`limits(ticker, account)\` - View an account's limit configuration

### Notes
- Limits are self-imposed by each holder
- Set limit to 0 to disable that limit
- Daily resets at UTC midnight
- Weekly resets on Monday UTC midnight`,
        image: "bafkreib3o3nkd5z3xhahpyrdcvbtk6ztu5ctth7wuxhqfqlk5gknyhazxe",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/transfer-controls/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
