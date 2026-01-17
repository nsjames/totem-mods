// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";

contract Freezer is TotemMod, IModTransfer {
    mapping(string => bool) public isFrozen;

    constructor(address _totemsContract, address payable _seller) TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function toggle(string calldata ticker) external onlyCreator(ticker) {
        isFrozen[ticker] = !isFrozen[ticker];
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        if (isFrozen[ticker]) {
            revert("Transfers are frozen for this token");
        }
    }
}
