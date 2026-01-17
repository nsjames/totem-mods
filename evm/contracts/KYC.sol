// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

contract KYC is TotemMod, IModTransfer, IModBurn, IModMint {
    mapping(string => mapping(address => bool)) public passedKYC;
    mapping(address => bool) public managers;

    constructor(address _totemsContract, address payable _seller) TotemMod(_totemsContract, _seller){
        managers[msg.sender] = true;
    }

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    modifier onlyManager() {
        require(managers[msg.sender], "Not a KYC manager");
        _;
    }

    function setManager(address manager, bool isManager) external onlyManager() {
        managers[manager] = isManager;
    }

    function toggle(string calldata ticker, address user) external onlyManager() {
        passedKYC[ticker][user] = !passedKYC[ticker][user];
    }

    function _hasPassedKYCOrIsMinter(string calldata ticker, address account) internal view returns (bool) {
        if (TotemsLibrary.isMinter(totemsContract, ticker, account)) return true;
        return passedKYC[ticker][account];
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(_hasPassedKYCOrIsMinter(ticker, from), "Sender has not passed KYC");
        require(_hasPassedKYCOrIsMinter(ticker, to), "Recipient has not passed KYC");
    }

    function onBurn(
        string calldata ticker,
        address owner,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(_hasPassedKYCOrIsMinter(ticker, owner), "Owner has not passed KYC");
    }

    function onMint(
        string calldata ticker,
        address minter,
        uint256 amount,
        uint256 payment,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(_hasPassedKYCOrIsMinter(ticker, minter), "Minter has not passed KYC");
    }
}
