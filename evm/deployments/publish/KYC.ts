import { Hook, type PublishConfig } from '../configs/index.js';

const config: PublishConfig = {
    contractName: "KYC",
    hooks: [Hook.Mint, Hook.Burn, Hook.Transfer],
    price: 0n,
    details: {
        name: "KYC",
        summary: "Require accounts to pass KYC verification before interacting with tokens.",
        markdown: `## KYC Mod

Requires accounts to pass KYC verification before they can transfer, mint, or burn tokens.

### Manager Functions
- \`setManager(account, isManager)\` - Add or remove a KYC manager
- \`toggle(ticker, account)\` - Toggle an account's KYC status

### View Functions
- \`passedKYC(ticker, account)\` - Check if an account has passed KYC
- \`managers(account)\` - Check if an account is a manager

### Notes
- The deployer is automatically a manager
- KYC is per-ticker, users may need verification for each totem
- Minter mods are excluded from KYC checks`,
        image: "bafkreiftqrpzam5c42jj3qdeslt6g37w7qxdgxwgn6dveazudajntqre5m",
        website: "https://mods.totems.fun/kyc",
        websiteTickerPath: "",
        isMinter: false,
        needsUnlimited: false,
    },
    requiredActions: [],
};

export default config;
