import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "Blocklist",
    hooks: [Hook.Mint, Hook.Burn, Hook.Transfer],
    price: 0n,
    details: {
        name: "Blocklist",
        summary: "Allow the creator to block specific addresses from token operations.",
        markdown: `## Blocklist Mod

Allows the totem creator to blocklist addresses from transferring, minting, or burning tokens.

### Usage
- \`toggle(ticker, account)\` - Toggle an account's blocked status (creator only)
- \`blocked(ticker, account)\` - Check if an account is blocked

### Notes
- Blocked addresses cannot send or receive tokens
- Blocked addresses cannot mint or burn tokens
- Minter mods are excluded from blocklist checks`,
        image: "bafkreidmx7ig4tduvp44ffqi5t6uguipzlhgp4ftui6t3fwj2j4gh6dumm",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/blocklist/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
