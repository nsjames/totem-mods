import { Hook, ModActionFieldInputMode, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "WhaleBlock",
    hooks: [Hook.Transfer],
    price: 0n,
    details: {
        name: "Whale Block",
        summary: "Prevent any address from holding more than a percentage of total supply.",
        markdown: `## Whale Block Mod

Prevents any single address from accumulating more than a configured percentage of the total token supply.

### Setup Required
Call \`configure(ticker, maxTokenPercentage)\` to set the maximum percentage (1-100).

### Notes
- Minter mods are excluded from whale checks
- The check is performed on the recipient's balance after transfer`,
        image: "bafkreihuvg72cvxv27an2yqypwwoj4wemajsupdonnjfscuphga4twzxoe",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/whaleblock/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [
        {
            signature: "configure(string ticker, uint8 _maxTokenPercentage)",
            inputFields: [
                {
                    name: "ticker",
                    mode: ModActionFieldInputMode.TOTEM,
                    value: "",
                    description: "The totem ticker",
                    min: 0n,
                    max: 0n,
                    isTotems: false,
                },
                {
                    name: "_maxTokenPercentage",
                    mode: ModActionFieldInputMode.DYNAMIC,
                    value: "",
                    description: "Maximum percentage of supply any address can hold (1-100)",
                    min: 1n,
                    max: 100n,
                    isTotems: false,
                },
            ],
            cost: 0n,
            reason: "Configure the maximum token percentage before the mod can enforce limits",
        },
    ],
};

export default config;
