import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "ScamDefender",
    hooks: [Hook.Transfer],
    price: 0n,
    details: {
        name: "Scam Defender",
        summary: "Block known scam addresses from receiving tokens.",
        markdown: `## Scam Defender Mod

Allows managers to flag known scam addresses, preventing them from receiving tokens.

### Manager Functions
- \`setManager(account, isManager)\` - Add or remove a manager
- \`toggle(ticker, account)\` - Toggle an address's scam flag

### View Functions
- \`blocked(ticker, account)\` - Check if an address is flagged
- \`managers(account)\` - Check if an account is a manager

### Notes
- The deployer is automatically a manager
- Flagged addresses can still SEND tokens (to recover funds)
- Only receiving tokens is blocked`,
        image: "bafkreifky4cwnz7lgrjfzfmoxe5n6mj577ytn7tke7qhiheevkzv25wa6q",
        website: "https://mods.totems.fun/scam-defender",
        websiteTickerPath: "",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
