// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

contract Blocklist is TotemMod, IModTransfer, IModBurn, IModMint {
    mapping(string => mapping(address => bool)) public blocked;

    constructor(address _totemsContract, address payable _seller) TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function toggle(string calldata ticker, address user) external onlyCreator(ticker) {
        blocked[ticker][user] = !blocked[ticker][user];
    }

    function _isBlockedAndNotMinter(string calldata ticker, address account) internal view returns (bool) {
        if (TotemsLibrary.isMinter(totemsContract, ticker, account)) return false;
        return blocked[ticker][account];
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(!_isBlockedAndNotMinter(ticker, from), "Sender is blocklisted");
        require(!_isBlockedAndNotMinter(ticker, to), "Recipient is blocklisted");
    }

    function onBurn(
        string calldata ticker,
        address owner,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(!_isBlockedAndNotMinter(ticker, owner), "Owner is blocklisted");
    }

    function onMint(
        string calldata ticker,
        address minter,
        uint256 amount,
        uint256 payment,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(!_isBlockedAndNotMinter(ticker, minter), "Minter is blocklisted");
    }
}
