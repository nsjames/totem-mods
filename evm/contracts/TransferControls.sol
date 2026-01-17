// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";

contract TransferControls is TotemMod, IModTransfer {
    uint256 internal constant DAY  = 1 days;
    uint256 internal constant WEEK = 7 days;
    uint256 internal constant UNIX_WEEK_OFFSET = 3 days;

    struct Limits {
        uint256 dailyLimit;
        uint256 weeklyLimit;
        uint256 currentDailyTotal;
        uint256 currentWeeklyTotal;
        uint256 lastDailyReset;
        uint256 lastWeeklyReset;
    }

    mapping(string => mapping(address => Limits)) public limits;


    constructor(address _totemsContract, address payable _seller)
        TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function setLimits(string calldata ticker, uint256 dailyLimit, uint256 weeklyLimit) external {
        Limits storage _limits = limits[ticker][msg.sender];
        _limits.dailyLimit = dailyLimit;
        _limits.weeklyLimit = weeklyLimit;

        // initialize reset markers if first time
        if (_limits.lastDailyReset == 0) {
            _limits.lastDailyReset = _dayStart(block.timestamp);
        }
        if (_limits.lastWeeklyReset == 0) {
            _limits.lastWeeklyReset = _weekStart(block.timestamp);
        }
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        Limits storage userLimits = limits[ticker][from];

        uint256 todayStart = _dayStart(block.timestamp);
        uint256 thisWeek   = _weekStart(block.timestamp);

        // DAILY
        if (userLimits.dailyLimit > 0) {
            // Reset on day boundary
            if (userLimits.lastDailyReset < todayStart) {
                userLimits.currentDailyTotal = 0;
                userLimits.lastDailyReset = todayStart;
            }

            // Enforce limit
            if (userLimits.currentDailyTotal + amount > userLimits.dailyLimit) {
                revert("Daily transfer limit exceeded");
            }

            // Account
            userLimits.currentDailyTotal += amount;
        }

        // WEEKLY
        if (userLimits.weeklyLimit > 0) {
            // Reset on week boundary
            if (userLimits.lastWeeklyReset < thisWeek) {
                userLimits.currentWeeklyTotal = 0;
                userLimits.lastWeeklyReset = thisWeek;
            }

            // Enforce limit
            if (userLimits.currentWeeklyTotal + amount > userLimits.weeklyLimit) {
                revert("Weekly transfer limit exceeded");
            }

            // Account
            userLimits.currentWeeklyTotal += amount;
        }
    }



    function _dayStart(uint256 timestamp) internal pure returns (uint256) {
        return (timestamp / DAY) * DAY;
    }

    function _weekStart(uint256 timestamp) internal pure returns (uint256) {
        return ((timestamp - UNIX_WEEK_OFFSET) / WEEK) * WEEK + UNIX_WEEK_OFFSET;
    }
}
