// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@totems/evm/mods/TotemMod.sol";

interface ITotems {
    function getBalance(string calldata ticker, address account) external view returns (uint256);
    function transfer(string calldata ticker, address from, address to, uint256 amount, string calldata memo) external;
}

contract MinerMod is TotemMod, IModMinter, IModCreated, IModTransfer {
    uint256 internal constant DAY = 1 days;

    // ticker -> balance
    mapping(string => uint256) public balances;
    mapping(string => uint256) public totemsPerMine;
    mapping(string => uint256) public maxMinesPerDay;
    mapping(string => mapping(address => uint256)) public userMineCountToday;
    mapping(string => mapping(address => uint256)) public lastDailyReset;

    constructor(
        address _totemsContract,
        address payable _seller
    ) TotemMod(_totemsContract, _seller) {}

    function _validateSetup(
        uint256 _totemsPerMine,
        uint256 _maxMinesPerDay
    ) internal pure returns (bool valid, string memory reason) {
        if (_totemsPerMine == 0) {
            return (false, "totemsPerMine must be greater than zero");
        }
        if (_maxMinesPerDay == 0) {
            return (false, "maxMinesPerDay must be greater than zero");
        }
        return (true, "");
    }

    function canSetup(
        string calldata ticker,
        uint256 _totemsPerMine,
        uint256 _maxMinesPerDay
    ) public pure returns (bool valid, string memory reason) {
        return _validateSetup(_totemsPerMine, _maxMinesPerDay);
    }

    function setup(
        string calldata ticker,
        uint256 _totemsPerMine,
        uint256 _maxMinesPerDay
    ) external onlyCreator(ticker) onlyLicensed(ticker) {
        (bool valid, string memory reason) = _validateSetup(_totemsPerMine, _maxMinesPerDay);
        require(valid, reason);

        totemsPerMine[ticker] = _totemsPerMine;
        maxMinesPerDay[ticker] = _maxMinesPerDay;
    }

    function isSetupFor(string calldata ticker) external view override returns (bool) {
        return totemsPerMine[ticker] > 0;
    }

    /**
     * @notice Example created hook - no-op implementation
     */
    function onCreated(
        string calldata ticker,
        address creator
    ) external override onlyTotems onlyLicensed(ticker) {
        balances[ticker] = ITotems(totemsContract).getBalance(ticker, address(this));
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external override onlyTotems onlyLicensed(ticker) {
        if (to == address(this)) {
            balances[ticker] += amount;
        }
    }

    function mint(
        string calldata ticker,
        address minter,
        uint256 amount,
        string calldata memo
    ) external payable override onlyTotems onlyLicensed(ticker) onlySetup(ticker) {
        require(msg.value == 0, "Mining is free, no payment required");
        require(amount == 0, "Amount must be zero, mining mints fixed amount");

        uint256 mineAmount = totemsPerMine[ticker];
        uint256 maxMines = maxMinesPerDay[ticker];

        uint256 todayStart = _dayStart(block.timestamp);

        // Reset daily mining count if new day
        if (lastDailyReset[ticker][minter] < todayStart) {
            userMineCountToday[ticker][minter] = 0;
            lastDailyReset[ticker][minter] = todayStart;
        }

        require(userMineCountToday[ticker][minter] < maxMines, "User has reached max mines for today");
        userMineCountToday[ticker][minter] += 1;

        require(balances[ticker] >= mineAmount, "Not enough left to mine");
        balances[ticker] -= mineAmount;

        ITotems(totemsContract).transfer(ticker, address(this), minter, mineAmount, "");

        balances[ticker] = ITotems(totemsContract).getBalance(ticker, address(this));
    }

    function _dayStart(uint256 timestamp) internal pure returns (uint256) {
        return (timestamp / DAY) * DAY;
    }
}