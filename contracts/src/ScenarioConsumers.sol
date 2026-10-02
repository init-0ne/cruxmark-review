// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IFeed, IStockStatus, PriceGuard} from "./PriceGuard.sol";

/// @notice Stock-token surface needed by the sandbox consumers.
/// @dev Only pause/multiplier reads; this is not an ERC-20.
interface IStockToken is IStockStatus {
    function uiMultiplier() external view returns (uint256);
}

/// @notice Deliberately faulty consumer: applies the shares-per-token multiplier
/// on top of an already-adjusted per-token feed and skips pause/freshness/
/// sequencer checks. Owned sandbox demonstration only; never use with real assets.
contract UnsafeStockConsumer {
    error InvalidConfiguration();
    error PriceUnavailable();
    error BorrowExceedsCap();
    error RepayExceedsDebt();

    IFeed public immutable priceFeed;
    IStockToken public immutable stockToken;
    uint256 public constant LTV_BPS = 6000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;

    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);

    constructor(address price, address token) {
        if (price.code.length == 0 || token.code.length == 0) revert InvalidConfiguration();
        priceFeed = IFeed(price);
        stockToken = IStockToken(token);
    }

    /// @notice Track synthetic collateral. No token transfer; no price read.
    function deposit(uint256 amount) external {
        collateral[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Faulty valuation: per-token answer multiplied by uiMultiplier again.
    /// @dev Intentionally omits pause, freshness and sequencer checks.
    function collateralValue(address user) public view returns (uint256) {
        (, int256 answer,,,) = priceFeed.latestRoundData();
        if (answer <= 0) revert PriceUnavailable();
        uint8 scale = priceFeed.decimals();
        if (scale > 18) revert PriceUnavailable();
        uint256 base = collateral[user] * uint256(answer) / (10 ** uint256(scale));
        return base * stockToken.uiMultiplier() / 1e18;
    }

    function maxBorrow(address user) public view returns (uint256) {
        return collateralValue(user) * LTV_BPS / BPS_DENOMINATOR;
    }

    /// @notice Synthetic borrow against the faulty valuation.
    function borrow(uint256 amount) external {
        uint256 cap = maxBorrow(msg.sender);
        if (debt[msg.sender] + amount > cap) revert BorrowExceedsCap();
        debt[msg.sender] += amount;
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Safe repayment never reads a price, so it stays callable.
    function repay(uint256 amount) external {
        if (amount > debt[msg.sender]) revert RepayExceedsDebt();
        debt[msg.sender] -= amount;
        emit Repaid(msg.sender, amount);
    }
}

/// @notice Guarded consumer: values synthetic collateral through PriceGuard once,
/// so pause/stale/sequencer faults reject price-dependent borrowing while
/// deposits and repayments remain available.
contract GuardedStockConsumer {
    error InvalidConfiguration();
    error BorrowExceedsCap();
    error RepayExceedsDebt();

    PriceGuard public immutable guard;
    uint256 public constant LTV_BPS = 6000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;

    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);

    constructor(address guardAddress) {
        if (guardAddress.code.length == 0) revert InvalidConfiguration();
        guard = PriceGuard(guardAddress);
    }

    /// @notice Track synthetic collateral. No token transfer; no price read.
    function deposit(uint256 amount) external {
        collateral[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function collateralValue(address user) public view returns (uint256) {
        return guard.valueUsd18(collateral[user]);
    }

    function maxBorrow(address user) public view returns (uint256) {
        return collateralValue(user) * LTV_BPS / BPS_DENOMINATOR;
    }

    /// @notice Borrow reverts with the guard's Price/Sequencer errors when inputs
    /// are unavailable, and with BorrowExceedsCap when the correct cap is exceeded.
    function borrow(uint256 amount) external {
        uint256 cap = maxBorrow(msg.sender);
        if (debt[msg.sender] + amount > cap) revert BorrowExceedsCap();
        debt[msg.sender] += amount;
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Safe repayment never reads a price, so it stays callable while
    /// price-dependent borrowing is blocked.
    function repay(uint256 amount) external {
        if (amount > debt[msg.sender]) revert RepayExceedsDebt();
        debt[msg.sender] -= amount;
        emit Repaid(msg.sender, amount);
    }
}
