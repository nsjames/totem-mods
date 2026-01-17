// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

contract WhaleBlock is TotemMod, IModTransfer {
    // recipient can only have up to this % of the total supply after the transfer
    mapping(string => uint8) public maxTokenPercentage;


    constructor(address _totemsContract, address payable _seller)
        TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function configure(string calldata ticker, uint8 _maxTokenPercentage) external onlyCreator(ticker) {
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
