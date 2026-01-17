// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";

contract Extinguisher is TotemMod, IModBurn {
    constructor(address _totemsContract, address payable _seller) TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function onBurn(
        string calldata ticker,
        address owner,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(false, "This totem cannot be burned");
    }
}
