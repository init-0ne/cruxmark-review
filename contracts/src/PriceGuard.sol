// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

interface IStockStatus {
    function oraclePaused() external view returns (bool);
}

/// @notice Testnet prototype for per-token USD feeds; not a lending protocol or audit certificate.
contract PriceGuard {
    error InvalidConfiguration();
    error PriceUnavailable();
    error SequencerUnavailable();

    IFeed public immutable priceFeed;
    IFeed public immutable sequencerFeed;
    IStockStatus public immutable stockToken;
    uint256 public immutable maxAge;
    uint256 public immutable gracePeriod;

    constructor(address price, address sequencer, address token, uint256 age, uint256 grace) {
        if (
            price.code.length == 0 || sequencer.code.length == 0 || token.code.length == 0
                || age == 0 || grace == 0
        ) revert InvalidConfiguration();
        priceFeed = IFeed(price);
        sequencerFeed = IFeed(sequencer);
        stockToken = IStockStatus(token);
        maxAge = age;
        gracePeriod = grace;
    }

    /// @return value USD scaled by 1e18 for a raw token balance scaled by 1e18.
    /// @dev Never multiply a per-token feed by the stock's uiMultiplier again.
    function valueUsd18(uint256 rawBalance18) external view returns (uint256 value) {
        (, int256 status, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        if (
            status != 0 || startedAt == 0 || startedAt > block.timestamp
                || block.timestamp - startedAt <= gracePeriod
        ) revert SequencerUnavailable();
        if (stockToken.oraclePaused()) revert PriceUnavailable();

        (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
        if (
            answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp
                || block.timestamp - updatedAt > maxAge
        ) revert PriceUnavailable();
        uint8 scale = priceFeed.decimals();
        if (scale > 18) revert PriceUnavailable();
        // ponytail: checked multiplication rejects extreme balances; use vetted mulDiv for wider ranges.
        value = rawBalance18 * uint256(answer) / (10 ** uint256(scale));
    }
}
