// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

contract Allowlist is TotemMod, IModTransfer {
    // ticker -> sender -> recipient
    mapping(string => mapping(address => mapping(address => bool))) public allowed;

    constructor(address _totemsContract, address payable _seller) TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function toggle(string calldata ticker, address user, bool approved) external {
        allowed[ticker][msg.sender][user] = approved;
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        // Minters are excluded from allowlist checks
        if (TotemsLibrary.isMinter(totemsContract, ticker, from)) return;
        if (TotemsLibrary.isMinter(totemsContract, ticker, to)) return;

        if (!allowed[ticker][from][to]) {
            revert("Transfer not allowed by allowlist");
        }
    }
}
