import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "Extinguisher",
    hooks: [Hook.Burn],
    price: 0n,
    details: {
        name: "Extinguisher",
        summary: "Disable burning functionality for a totem.",
        markdown: `## Extinguisher Mod

Completely disables the ability to burn tokens.

### Behavior
- Any burn attempt will revert with "This totem cannot be burned"
- This is a permanent restriction while the mod is licensed

### Use Cases
- Tokens that should never be deflationary
- Tokens where supply should only ever increase or stay constant`,
        image: "bafkreigiyifyhpyknnkuxnpcqiyvbhz2b55vqklluoj44udjve4tuuqmtu",
        website: "",
        websiteTickerPath: "",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
