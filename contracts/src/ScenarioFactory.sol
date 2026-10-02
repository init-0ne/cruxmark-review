// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "./PriceGuard.sol";
import {GuardedStockConsumer, UnsafeStockConsumer} from "./ScenarioConsumers.sol";
import {MockFeed, MockStockStatus} from "./mocks/MockInputs.sol";

/// @notice One isolated sandbox run. The instance owns its mocks, so only the
/// scenario owner can inject faults; per-account positions keep users apart
/// inside the shared consumer contracts if an instance is ever reused.
contract ScenarioInstance {
    enum Fault {
        Healthy,
        Split,
        Paused,
        Stale,
        SequencerDown,
        RecoveryGrace
    }

    uint256 public constant MAX_AGE = 300;
    uint256 public constant GRACE_PERIOD = 3600;
    address public immutable owner;
    MockFeed public immutable price;
    MockFeed public immutable sequencer;
    MockStockStatus public immutable token;
    PriceGuard public immutable guard;
    UnsafeStockConsumer public immutable unsafeConsumer;
    GuardedStockConsumer public immutable guardedConsumer;

    event TokenStateUpdated(bool paused, uint256 multiplier);
    event PriceRoundUpdated(int256 answer, uint256 startedAt, uint256 updatedAt);
    event SequencerRoundUpdated(int256 status, uint256 startedAt, uint256 updatedAt);
    event ScenarioConfigured(Fault fault, uint256 timestamp);

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
        _configure(Fault.Healthy);
        guard = new PriceGuard(
            address(price), address(sequencer), address(token), MAX_AGE, GRACE_PERIOD
        );
        unsafeConsumer = new UnsafeStockConsumer(address(price), address(token));
        guardedConsumer = new GuardedStockConsumer(address(guard));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only scenario owner");
        _;
    }

    /// @notice Seed one fault atomically using chain time; clear all other faults.
    /// @dev RecoveryGrace simulates a recovery now. Healthy simulates recovery
    /// before the grace window; neither interrupts the real chain sequencer.
    function configureScenario(Fault fault) external onlyOwner {
        _configure(fault);
    }

    function _configure(Fault fault) private {
        uint256 nowTime = block.timestamp;
        require(nowTime > GRACE_PERIOD + 1, "Clock not initialized");
        token.setState(fault == Fault.Paused, fault == Fault.Split ? 2e18 : 1e18);
        uint256 priceTime = fault == Fault.Stale ? nowTime - MAX_AGE - 1 : nowTime;
        price.setRound(100e8, priceTime, priceTime);
        sequencer.setRound(
            fault == Fault.SequencerDown ? int256(1) : int256(0),
            fault == Fault.SequencerDown || fault == Fault.RecoveryGrace
                ? nowTime
                : nowTime - GRACE_PERIOD - 1,
            nowTime
        );
        emit ScenarioConfigured(fault, nowTime);
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

    function setSequencerRound(int256 status, uint256 startedAt, uint256 updatedAt)
        external
        onlyOwner
    {
        sequencer.setRound(status, startedAt, updatedAt);
        emit SequencerRoundUpdated(status, startedAt, updatedAt);
    }
}

/// @notice Creates isolated scenario instances so public runs never share
/// fault inputs. Each caller owns only the instances they create.
contract ScenarioFactory {
    event ScenarioCreated(address indexed owner, address indexed instance, uint256 index);

    mapping(address => address[]) private _scenarios;

    constructor() {
        require(
            block.chainid == 31337 || block.chainid == 46630 || block.chainid == 421614,
            "Test networks only"
        );
    }

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
