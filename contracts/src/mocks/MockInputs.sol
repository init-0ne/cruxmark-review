// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IFeed, IStockStatus} from "../PriceGuard.sol";

/// @notice Owned fault-injection input. No real issuer or Chainlink data is modified.
contract MockFeed is IFeed {
    address public immutable owner = msg.sender;
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public roundId;

    constructor(uint8 scale) {
        decimals = scale;
    }

    function setRound(int256 price, uint256 started, uint256 updated) external {
        require(msg.sender == owner, "Only scenario owner");
        answer = price;
        startedAt = started;
        updatedAt = updated;
        roundId++;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, startedAt, updatedAt, roundId);
    }
}

/// @notice Only the stock token's pause/multiplier surface. This is not an ERC-20.
contract MockStockStatus is IStockStatus {
    address public immutable owner = msg.sender;
    bool public oraclePaused;
    uint256 public uiMultiplier = 1e18;

    function setState(bool paused, uint256 multiplier) external {
        require(msg.sender == owner, "Only scenario owner");
        require(multiplier > 0, "Invalid multiplier");
        oraclePaused = paused;
        uiMultiplier = multiplier;
    }
}
