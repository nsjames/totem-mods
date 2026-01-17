// SPDX-License-Identifier: UNLICENSED

import "@totems/evm/mods/TotemMod.sol";
import "@totems/evm/mods/TotemsLibrary.sol";

contract InnerCircle is TotemMod, IModTransfer, IModMint, IModBurn {
    mapping(string => mapping(address => bool)) public members;
    mapping(string => uint256) public memberCount;
    mapping(string => mapping(address => mapping(address => bool))) public removalVotes;
    mapping(string => mapping(address => uint256)) public removalVoteCount;

    constructor(address _totemsContract, address payable _seller)
        TotemMod(_totemsContract, _seller){}

    function isSetupFor(string calldata ticker) external override view returns (bool) {
        return true;
    }

    function isMember(string calldata ticker, address account) public view returns (bool) {
        if (account == TotemsLibrary.getCreator(totemsContract, ticker)) return true;
        return members[ticker][account];
    }

    function addMember(string calldata ticker, address account) external {
        require(!members[ticker][account], "Already a member");

        address creator = TotemsLibrary.getCreator(totemsContract, ticker);
        if (msg.sender != creator) {
            require(members[ticker][msg.sender], "Only members can sponsor new members");
        }

        members[ticker][account] = true;
        memberCount[ticker] += 1;
    }

    function voteToRemove(string calldata ticker, address target) external {
        require(members[ticker][msg.sender], "Only members can vote");

        address creator = TotemsLibrary.getCreator(totemsContract, ticker);
        require(target != creator, "Cannot vote to remove the creator");

        require(members[ticker][target], "Target is not a member");
        require(msg.sender != target, "Cannot vote on your own removal");
        require(!removalVotes[ticker][target][msg.sender], "Already voted");

        removalVotes[ticker][target][msg.sender] = true;
        removalVoteCount[ticker][target] += 1;

        // Check if majority reached (>50% of eligible voters, excluding target)
        uint256 eligibleVoters = memberCount[ticker] - 1; // exclude target
        if (removalVoteCount[ticker][target] * 2 > eligibleVoters) {
            _removeMember(ticker, target);
        }
    }

    function retractVote(string calldata ticker, address target) external {
        require(removalVotes[ticker][target][msg.sender], "No vote to retract");

        removalVotes[ticker][target][msg.sender] = false;
        removalVoteCount[ticker][target] -= 1;
    }

    function _removeMember(string memory ticker, address account) internal {
        members[ticker][account] = false;
        memberCount[ticker] -= 1;

        // Clear votes cast by this member against others
        // Note: We can't iterate mappings, so we just clear their vote count
        // Individual vote records will be stale but harmless
        removalVoteCount[ticker][account] = 0;
    }

    function _isMemberOrExcluded(string calldata ticker, address account) internal view returns (bool) {
        if (account == address(this)) return true;
        if (TotemsLibrary.isMinter(totemsContract, ticker, account)) return true;
        return isMember(ticker, account);
    }

    function onTransfer(
        string calldata ticker,
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(_isMemberOrExcluded(ticker, from), "Sender is not a member");
        require(_isMemberOrExcluded(ticker, to), "Recipient is not a member");
    }

    function onMint(
        string calldata ticker,
        address minter,
        uint256 amount,
        uint256 payment,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(_isMemberOrExcluded(ticker, minter), "Minter is not a member");
    }

    function onBurn(
        string calldata ticker,
        address owner,
        uint256 amount,
        string calldata memo
    ) external onlyTotems onlyLicensed(ticker) {
        require(_isMemberOrExcluded(ticker, owner), "Owner is not a member");
    }
}
