// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

contract WhaleBlock is TotemMod, IModTransfer {
    // recipient can only have up to this % of the total supply after the transfer
    mapping(string => uint8) public maxTokenPercentage;


    constructor(address _totemsContract, address payable _seller)
        TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return maxTokenPercentage[ticker] > 0;
    }

    function canConfigure(
        string calldata ticker,
        uint8 _maxTokenPercentage
    ) public pure returns (bool valid, string memory reason) {
        if (_maxTokenPercentage == 0) {
            return (false, "maxTokenPercentage must be greater than zero");
        }
        if (_maxTokenPercentage > 100) {
            return (false, "maxTokenPercentage must be 100 or less");
        }
        return (true, "");
    }

    function configure(string calldata ticker, uint8 _maxTokenPercentage) external onlyCreator(ticker) onlyLicensed(ticker) {
        (bool valid, string memory reason) = canConfigure(ticker, _maxTokenPercentage);
        require(valid, reason);
        maxTokenPercentage[ticker] = _maxTokenPercentage;
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        if (maxTokenPercentage[ticker] == 0) return;

        // Minters are excluded from whale checks
        if (TotemsLibrary.isMinter(totemsContract, ticker, to)) return;

        uint256 recipientBalance = TotemsLibrary.getBalance(totemsContract, ticker, to);
        require(
            recipientBalance + amount <= (TotemsLibrary.getTotem(totemsContract, ticker).supply * maxTokenPercentage[ticker]) / 100,
            "No whales allowed!"
        );
    }
}
