// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "../src/PriceGuard.sol";
import {MockFeed, MockStockStatus} from "../src/mocks/MockInputs.sol";

interface VmTest {
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function prank(address) external;
}

contract PriceGuardTest {
    VmTest constant vm = VmTest(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockFeed price;
    MockFeed sequencer;
    MockStockStatus token;
    PriceGuard guard;

    function setUp() public {
        vm.warp(10_000);
        price = new MockFeed(8);
        sequencer = new MockFeed(0);
        token = new MockStockStatus();
        price.setRound(100e8, 10_000, 10_000);
        sequencer.setRound(0, 1, 1);
        guard = new PriceGuard(address(price), address(sequencer), address(token), 300, 3600);
    }

    function testSplitDoesNotDoubleCollateral() public {
        token.setState(false, 2e18);
        uint256 correct = guard.valueUsd18(100e18);
        uint256 seededUnsafeValue = correct * token.uiMultiplier() / 1e18;
        require(correct == 10_000e18, "Wrong token value");
        require(seededUnsafeValue == 20_000e18, "Seeded fault not reproduced");
        require(correct * 60 / 100 == 6000e18, "Wrong correct borrow cap");
        require(seededUnsafeValue * 60 / 100 == 12_000e18, "Wrong unsafe borrow cap");
    }

    function testPositiveStalePriceRejected() public {
        vm.warp(10_301);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guard.valueUsd18(100e18);
    }

    function testHeartbeatBoundaryAccepted() public {
        vm.warp(10_300);
        require(guard.valueUsd18(100e18) == 10_000e18, "Heartbeat boundary");
    }

    function testPausedPositiveFreshPriceRejected() public {
        token.setState(true, 1e18);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guard.valueUsd18(100e18);
    }

    function testSequencerDownRejected() public {
        sequencer.setRound(1, 1, 10_000);
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guard.valueUsd18(100e18);
    }

    function testRecoveryGraceBoundaryRejectedThenAllowed() public {
        sequencer.setRound(0, 6400, 10_000);
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guard.valueUsd18(100e18);
        vm.warp(10_001);
        require(guard.valueUsd18(100e18) == 10_000e18, "Recovery never opens");
    }

    function testUninitializedSequencerRejected() public {
        sequencer.setRound(0, 0, 0);
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guard.valueUsd18(100e18);
    }

    function testFutureSequencerTimestampRejected() public {
        sequencer.setRound(0, 10_001, 10_001);
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guard.valueUsd18(100e18);
    }

    function testZeroNegativeMissingAndFuturePricesRejected() public {
        price.setRound(0, 10_000, 10_000);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guard.valueUsd18(100e18);
        price.setRound(-1, 10_000, 10_000);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guard.valueUsd18(100e18);
        price.setRound(100e8, 0, 0);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guard.valueUsd18(100e18);
        price.setRound(100e8, 10_001, 10_001);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guard.valueUsd18(100e18);
    }

    function testSixDecimalFeed() public {
        MockFeed six = new MockFeed(6);
        six.setRound(100e6, 10_000, 10_000);
        PriceGuard alternate =
            new PriceGuard(address(six), address(sequencer), address(token), 300, 3600);
        require(alternate.valueUsd18(100e18) == 10_000e18, "Hardcoded decimals");
    }

    function testUnsupportedDecimalsRejected() public {
        MockFeed wide = new MockFeed(19);
        wide.setRound(100e19, 10_000, 10_000);
        PriceGuard alternate =
            new PriceGuard(address(wide), address(sequencer), address(token), 300, 3600);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        alternate.valueUsd18(100e18);
    }

    function testEveryInvalidConfigurationRejected() public {
        address eoa = address(0xBEEF);
        vm.expectRevert(PriceGuard.InvalidConfiguration.selector);
        new PriceGuard(eoa, address(sequencer), address(token), 300, 3600);
        vm.expectRevert(PriceGuard.InvalidConfiguration.selector);
        new PriceGuard(address(price), eoa, address(token), 300, 3600);
        vm.expectRevert(PriceGuard.InvalidConfiguration.selector);
        new PriceGuard(address(price), address(sequencer), eoa, 300, 3600);
        vm.expectRevert(PriceGuard.InvalidConfiguration.selector);
        new PriceGuard(address(price), address(sequencer), address(token), 0, 3600);
        vm.expectRevert(PriceGuard.InvalidConfiguration.selector);
        new PriceGuard(address(price), address(sequencer), address(token), 300, 0);
        // The smallest valid windows are accepted.
        new PriceGuard(address(price), address(sequencer), address(token), 1, 1);
    }

    function testZeroAndEighteenDecimalFeedsAreSupported() public {
        MockFeed whole = new MockFeed(0);
        whole.setRound(100, 10_000, 10_000);
        PriceGuard zeroScale =
            new PriceGuard(address(whole), address(sequencer), address(token), 300, 3600);
        require(zeroScale.valueUsd18(100e18) == 10_000e18, "Zero-decimal feed");

        MockFeed wide = new MockFeed(18);
        wide.setRound(100e18, 10_000, 10_000);
        PriceGuard eighteenScale =
            new PriceGuard(address(wide), address(sequencer), address(token), 300, 3600);
        require(eighteenScale.valueUsd18(100e18) == 10_000e18, "Eighteen-decimal feed");
    }

    function testBalanceProductOverflowRevertsInsteadOfWrapping() public {
        // Feed answer is 100e8, so this is the largest balance whose product fits.
        uint256 limit = type(uint256).max / 100e8;
        require(guard.valueUsd18(limit) == limit * 100e8 / 1e8, "Largest representable balance");
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        guard.valueUsd18(limit + 1);
    }

    function testMockRejectsZeroMultiplier() public {
        vm.expectRevert(bytes("Invalid multiplier"));
        token.setState(false, 0);
    }

    /// @dev Opens exactly when the price is at most maxAge old AND the sequencer
    /// has been up for strictly longer than the grace period; the sequencer
    /// check runs first, so it names the rejection when both fail.
    function testFuzzFreshnessAndRecoveryWindows(uint16 priceAge, uint16 sequencerUp) public {
        uint256 age = uint256(priceAge) % 10_000;
        uint256 up = uint256(sequencerUp) % 9_999 + 1; // never 0: that means uninitialized
        price.setRound(100e8, 10_000 - age, 10_000 - age);
        sequencer.setRound(0, 10_000 - up, 10_000 - up);
        bool open = age <= 300 && up > 3600;
        try guard.valueUsd18(100e18) returns (uint256 value) {
            require(open, "Opened outside the windows");
            require(value == 10_000e18, "Wrong value");
        } catch (bytes memory reason) {
            require(!open, "Closed inside the windows");
            bytes4 expected = up <= 3600
                ? PriceGuard.SequencerUnavailable.selector
                : PriceGuard.PriceUnavailable.selector;
            require(bytes4(reason) == expected, "Wrong rejection");
        }
    }

    function testMockFaultsRequireScenarioOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes("Only scenario owner"));
        price.setRound(1, 1, 1);
        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes("Only scenario owner"));
        token.setState(true, 2e18);
    }

    function testFuzzTokenValueNeverAppliesMultiplier(uint96 rawAmount, uint64 multiplier) public {
        token.setState(false, uint256(multiplier) + 1);
        require(guard.valueUsd18(rawAmount) == uint256(rawAmount) * 100, "Multiplier affects USD");
    }
}
