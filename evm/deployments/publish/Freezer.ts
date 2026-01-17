import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "Freezer",
    hooks: [Hook.Transfer],
    price: 0n,
    details: {
        name: "Freezer",
        summary: "Allow the creator to freeze all transfers.",
        markdown: `## Freezer Mod

Gives the totem creator the ability to freeze all token transfers.

### Usage
- \`toggle(ticker)\` - Toggle the frozen state (creator only)
- \`isFrozen(ticker)\` - Check if transfers are frozen

### Notes
- When frozen, all transfers will revert
- Only the totem creator can toggle the freeze state`,
        image: "bafkreidb4rxlzo2lz5knapixc4ahrbv24ro7bxv2pqmnh3zmne7wkofaim",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/freezer/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
