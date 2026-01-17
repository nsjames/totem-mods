import { Hook, ModActionFieldInputMode, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "Miner",
    hooks: [Hook.Created, Hook.Mint, Hook.Transfer],
    price: 0n,
    details: {
        name: "Miner",
        summary: "Mine totems over time with configurable rates and daily limits.",
        markdown: `## Miner Mod

Allows holders to "mine" tokens by submitting transactions. Configure the amount per mine and max mines per day.

### Setup Required
The totem creator must call \`setup(ticker, totemsPerMine, maxMinesPerDay)\` to configure mining parameters.`,
        image: "bafkreihhbm4wogibw3oacdoeejpfari2t3d7caaosbcf674efffwkr3b6m",
        website: "https://mods.totems.fun",
        websiteTickerPath: "/mine/{ticker}",
        isMinter: true,
        needsUnlimited: false,
    },
    requiredActions: [
        {
            signature: "setup(string ticker, uint256 _totemsPerMine, uint256 _maxMinesPerDay)",
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
                    name: "_totemsPerMine",
                    mode: ModActionFieldInputMode.DYNAMIC,
                    value: "",
                    description: "Amount of totems to award per mine transaction",
                    min: 1n,
                    max: 0n,
                    isTotems: true,
                },
                {
                    name: "_maxMinesPerDay",
                    mode: ModActionFieldInputMode.DYNAMIC,
                    value: "",
                    description: "Maximum number of mines per user per day",
                    min: 1n,
                    max: 0n,
                    isTotems: false,
                },
            ],
            cost: 0n,
            reason: "Configure mining parameters before mining can begin",
        },
    ],
};

export default config;
