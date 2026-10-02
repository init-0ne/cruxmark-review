// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "./PriceGuard.sol";
import {GuardedStockConsumer, UnsafeStockConsumer} from "./ScenarioConsumers.sol";
import {MockFeed, MockStockStatus} from "./mocks/MockInputs.sol";

/// @notice One isolated sandbox run. The instance owns its mocks, so only the
/// scenario owner can inject faults; per-account positions keep users apart
/// inside the shared consumer contracts if an instance is ever reused.
contract ScenarioInstance {
    address public immutable owner;
    MockFeed public immutable price;
    MockFeed public immutable sequencer;
    MockStockStatus public immutable token;
    PriceGuard public immutable guard;
    UnsafeStockConsumer public immutable unsafeConsumer;
    GuardedStockConsumer public immutable guardedConsumer;

    event TokenStateUpdated(bool paused, uint256 multiplier);
    event PriceRoundUpdated(int256 answer, uint256 startedAt, uint256 updatedAt);

    constructor(address runOwner) {
        require(
            block.chainid == 31337 || block.chainid == 46630 || block.chainid == 421614,
            "Test networks only"
        );
        require(block.timestamp > 3601, "Clock not initialized");
        require(runOwner != address(0), "Invalid owner");
        owner = runOwner;
        price = new MockFeed(8);
        sequencer = new MockFeed(0);
        token = new MockStockStatus();
        price.setRound(100e8, block.timestamp, block.timestamp);
        sequencer.setRound(0, block.timestamp - 3601, block.timestamp);
        guard = new PriceGuard(address(price), address(sequencer), address(token), 300, 3600);
        unsafeConsumer = new UnsafeStockConsumer(address(price), address(token));
        guardedConsumer = new GuardedStockConsumer(address(guard));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only scenario owner");
        _;
    }

    /// @notice Inject or clear the split fault: multiplier 1 (healthy) or 2 (split).
    /// @dev Pause flag is left untouched; use setTokenState for paused cases.
    function setSplitMultiplier(uint256 multiplier) external onlyOwner {
        bool paused = token.oraclePaused();
        token.setState(paused, multiplier);
        emit TokenStateUpdated(paused, multiplier);
    }

    function setTokenState(bool paused, uint256 multiplier) external onlyOwner {
        token.setState(paused, multiplier);
        emit TokenStateUpdated(paused, multiplier);
    }

    function setPriceRound(int256 answer, uint256 startedAt, uint256 updatedAt) external onlyOwner {
        price.setRound(answer, startedAt, updatedAt);
        emit PriceRoundUpdated(answer, startedAt, updatedAt);
    }
}

/// @notice Creates isolated scenario instances so public runs never share
/// fault inputs. Each caller owns only the instances they create.
contract ScenarioFactory {
    event ScenarioCreated(address indexed owner, address indexed instance, uint256 index);

    mapping(address => address[]) private _scenarios;

    function createScenario() external returns (ScenarioInstance instance) {
        instance = new ScenarioInstance(msg.sender);
        _scenarios[msg.sender].push(address(instance));
        emit ScenarioCreated(msg.sender, address(instance), _scenarios[msg.sender].length - 1);
    }

    function scenarioCount(address user) external view returns (uint256) {
        return _scenarios[user].length;
    }

    function scenarios(address user, uint256 index) external view returns (address) {
        return _scenarios[user][index];
    }

    function myScenarios() external view returns (address[] memory) {
        return _scenarios[msg.sender];
    }
}
