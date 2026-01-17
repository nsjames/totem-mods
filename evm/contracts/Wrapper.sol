// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Wrapper is TotemMod, IModCreated, IModTransfer {
    // totem ticker -> accepted ERC20 token address
    mapping(string => address) public acceptedToken;
    // totem ticker -> wrapped totem balance held by this contract
    mapping(string => uint256) public wrappedBalance;

    constructor(address _totemsContract, address payable _seller)
        TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return acceptedToken[ticker] != address(0);
    }

    function setAcceptedToken(string calldata ticker, address token) external onlyCreator(ticker) {
        require(acceptedToken[ticker] == address(0), "Token already set");
        require(token != address(0), "Invalid token address");
        acceptedToken[ticker] = token;
    }

    function onCreated(
        string calldata ticker,
        address creator
    ) external onlyTotems onlyLicensed(ticker) {
        uint256 balance = TotemsLibrary.getBalance(totemsContract, ticker, address(this));
        wrappedBalance[ticker] = balance;
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        // Only handle transfers TO this contract (unwrapping)
        if (to != address(this)) return;

        address token = acceptedToken[ticker];
        require(token != address(0), "No accepted token configured");

        // Update wrapped balance
        wrappedBalance[ticker] += amount;

        // Send ERC20 back to the sender
        require(IERC20(token).transfer(from, amount), "ERC20 transfer failed");
    }

    function wrap(string calldata ticker, uint256 amount) external onlySetup(ticker) {
        require(amount > 0, "Amount must be greater than 0");
        require(wrappedBalance[ticker] >= amount, "Insufficient wrapped balance");

        address token = acceptedToken[ticker];

        // Pull ERC20 from sender (they must have approved this contract first)
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "ERC20 transferFrom failed");

        // Update wrapped balance
        wrappedBalance[ticker] -= amount;

        // Send wrapped totems to sender
        TotemsLibrary.transfer(totemsContract, ticker, msg.sender, amount, "wrap");
    }
}
