import { Hook, ModActionFieldInputMode, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "Wrapper",
    hooks: [Hook.Created, Hook.Transfer],
    price: 0n,
    details: {
        name: "ERC20 Wrapper",
        summary: "Wrap and unwrap ERC20 tokens as Totems.",
        markdown: `## Wrapper Mod

Allows wrapping existing ERC20 tokens as Totems and unwrapping them back.

### Setup Required
The totem creator must call \`setAcceptedToken(ticker, tokenAddress)\` to configure which ERC20 token can be wrapped.

### Usage
- **Wrap**: Approve the wrapper contract, then call \`wrap(ticker, amount)\`
- **Unwrap**: Transfer totems to the wrapper contract address`,
        image: "bafkreihkdb3w3gt4k4ejdorl6fyuafag73dnu6qx36llgvmujs5gmwbu4m",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/erc20-wrapper/{ticker}",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [
        {
            signature: "setAcceptedToken(string ticker, address token)",
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
                    name: "token",
                    mode: ModActionFieldInputMode.DYNAMIC,
                    value: "",
                    description: "The ERC20 token address to accept for wrapping",
                    min: 0n,
                    max: 0n,
                    isTotems: false,
                },
            ],
            cost: 0n,
            reason: "Configure which ERC20 token can be wrapped",
        },
    ],
};

export default config;
