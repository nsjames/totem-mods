// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";

contract ScamDefender is TotemMod, IModTransfer {
    mapping(string => mapping(address => bool)) public blocked;
    mapping(address => bool) public managers;

    constructor(address _totemsContract, address payable _seller) TotemMod(_totemsContract, _seller){
        managers[msg.sender] = true;
    }

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    modifier onlyManager() {
        require(managers[msg.sender], "Not a manager");
        _;
    }

    function setManager(address manager, bool isManager) external onlyManager() {
        managers[manager] = isManager;
    }

    function toggle(string calldata ticker, address user) external onlyManager() {
        blocked[ticker][user] = !blocked[ticker][user];
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(!blocked[ticker][to], "The recipient has been flagged for scams and cannot receive this totem");
    }
}
