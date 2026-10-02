// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "../src/PriceGuard.sol";
import {MockFeed, MockStockStatus} from "../src/mocks/MockInputs.sol";
import {GuardedStockConsumer, UnsafeStockConsumer} from "../src/ScenarioConsumers.sol";

interface VmConsumer {
    function warp(uint256) external;
    function assume(bool) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function prank(address) external;
}

contract ScenarioConsumersTest {
    VmConsumer constant vm = VmConsumer(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockFeed price;
    MockFeed sequencer;
    MockStockStatus token;
    PriceGuard guard;
    UnsafeStockConsumer unsafeConsumer;
    GuardedStockConsumer guardedConsumer;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        vm.warp(10_000);
        price = new MockFeed(8);
        sequencer = new MockFeed(0);
        token = new MockStockStatus();
        price.setRound(100e8, 10_000, 10_000);
        sequencer.setRound(0, 1, 1);
        guard = new PriceGuard(address(price), address(sequencer), address(token), 300, 3600);
        unsafeConsumer = new UnsafeStockConsumer(address(price), address(token));
        guardedConsumer = new GuardedStockConsumer(address(guard));
    }

    function testSplitFaultDoublesWhileGuardedStaysCorrect() public {
        token.setState(false, 2e18);
        unsafeConsumer.deposit(100e18);
        guardedConsumer.deposit(100e18);

        require(unsafeConsumer.collateralValue(address(this)) == 20_000e18, "Unsafe split value");
        require(guardedConsumer.collateralValue(address(this)) == 10_000e18, "Guarded split value");
        require(unsafeConsumer.maxBorrow(address(this)) == 12_000e18, "Unsafe split cap");
        require(guardedConsumer.maxBorrow(address(this)) == 6_000e18, "Guarded split cap");

        // The incorrect cap permits a 12k borrow the correct cap must reject.
        unsafeConsumer.borrow(12_000e18);
        require(unsafeConsumer.debt(address(this)) == 12_000e18, "Unsafe borrow not recorded");
        vm.expectRevert(GuardedStockConsumer.BorrowExceedsCap.selector);
        guardedConsumer.borrow(12_000e18);

        // The correct cap still permits a 6k borrow.
        guardedConsumer.borrow(6_000e18);
        require(guardedConsumer.debt(address(this)) == 6_000e18, "Guarded borrow not recorded");
    }

    function testHealthyInputsWorkInBoth() public {
        token.setState(false, 1e18);
        unsafeConsumer.deposit(100e18);
        guardedConsumer.deposit(100e18);

        require(unsafeConsumer.collateralValue(address(this)) == 10_000e18, "Unsafe healthy value");
        require(
            guardedConsumer.collateralValue(address(this)) == 10_000e18, "Guarded healthy value"
        );

        unsafeConsumer.borrow(6_000e18);
        guardedConsumer.borrow(6_000e18);
        unsafeConsumer.repay(6_000e18);
        guardedConsumer.repay(6_000e18);
        require(unsafeConsumer.debt(address(this)) == 0, "Unsafe repay failed");
        require(guardedConsumer.debt(address(this)) == 0, "Guarded repay failed");
    }

    function testExactBorrowBoundary() public {
        token.setState(false, 2e18);
        guardedConsumer.deposit(100e18);
        guardedConsumer.borrow(6_000e18);
        vm.expectRevert(GuardedStockConsumer.BorrowExceedsCap.selector);
        guardedConsumer.borrow(1);

        UnsafeStockConsumer fresh;
        fresh = new UnsafeStockConsumer(address(price), address(token));
        fresh.deposit(1);
        // 1 wei of collateral at $100 is 100 wei of correct value, doubled to
        // 200 wei by the seeded fault; the 60% cap is 120 wei.
        require(fresh.collateralValue(address(this)) == 200, "Dust valuation");
        require(fresh.maxBorrow(address(this)) == 120, "Dust cap");
        fresh.borrow(120);
        vm.expectRevert(UnsafeStockConsumer.BorrowExceedsCap.selector);
        fresh.borrow(1);
    }

    function testSafeRepayRemainsWhenGuardBlocked() public {
        guardedConsumer.deposit(100e18);
        guardedConsumer.borrow(1_000e18);
        token.setState(true, 1e18);

        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guardedConsumer.collateralValue(address(this));
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guardedConsumer.borrow(1);

        // Repayment does not read a price, so debt reduction stays available.
        guardedConsumer.repay(1_000e18);
        require(guardedConsumer.debt(address(this)) == 0, "Blocked repay failed");
    }

    function testUnsafePermitsWhileGuardedBlocksPausedPrice() public {
        token.setState(true, 1e18);
        unsafeConsumer.deposit(100e18);
        guardedConsumer.deposit(100e18);

        // Seeded fault keeps pricing a positive paused answer.
        require(unsafeConsumer.collateralValue(address(this)) == 10_000e18, "Unsafe paused value");
        unsafeConsumer.borrow(6_000e18);

        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guardedConsumer.borrow(1);
    }

    function testUsersCannotConsumeEachOthersCollateral() public {
        token.setState(false, 2e18);
        vm.prank(ALICE);
        guardedConsumer.deposit(100e18);

        require(guardedConsumer.collateralValue(ALICE) == 10_000e18, "Alice value");
        require(guardedConsumer.collateralValue(BOB) == 0, "Bob must start at zero");
        vm.expectRevert(GuardedStockConsumer.BorrowExceedsCap.selector);
        vm.prank(BOB);
        guardedConsumer.borrow(1);

        vm.prank(ALICE);
        guardedConsumer.borrow(6_000e18);
        require(guardedConsumer.debt(ALICE) == 6_000e18, "Alice debt");
        require(guardedConsumer.debt(BOB) == 0, "Bob debt polluted");
    }

    function testDecimalScalingMatchesGuard() public {
        MockFeed six = new MockFeed(6);
        six.setRound(100e6, 10_000, 10_000);
        token.setState(false, 2e18);
        UnsafeStockConsumer sixUnsafe = new UnsafeStockConsumer(address(six), address(token));
        PriceGuard sixGuard =
            new PriceGuard(address(six), address(sequencer), address(token), 300, 3600);
        GuardedStockConsumer sixGuarded = new GuardedStockConsumer(address(sixGuard));

        sixUnsafe.deposit(100e18);
        sixGuarded.deposit(100e18);
        require(sixGuarded.collateralValue(address(this)) == 10_000e18, "Six-decimal guarded");
        require(sixUnsafe.collateralValue(address(this)) == 20_000e18, "Six-decimal unsafe");
    }

    function testUnsupportedDecimalsRejected() public {
        MockFeed wide = new MockFeed(19);
        wide.setRound(100e19, 10_000, 10_000);
        UnsafeStockConsumer wideUnsafe = new UnsafeStockConsumer(address(price), address(token));
        // Unsafe still queries its own feed decimals; a 19-decimal feed is rejected.
        MockFeed nineteen = new MockFeed(19);
        nineteen.setRound(100e19, 10_000, 10_000);
        UnsafeStockConsumer bad = new UnsafeStockConsumer(address(nineteen), address(token));
        bad.deposit(100e18);
        vm.expectRevert(UnsafeStockConsumer.PriceUnavailable.selector);
        bad.collateralValue(address(this));

        PriceGuard wideGuard =
            new PriceGuard(address(wide), address(sequencer), address(token), 300, 3600);
        GuardedStockConsumer wideGuarded = new GuardedStockConsumer(address(wideGuard));
        wideGuarded.deposit(100e18);
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        wideGuarded.collateralValue(address(this));

        // Silence unused warning while keeping the construction rejection path explicit.
        wideUnsafe.deposit(0);
    }

    function testZeroCollateralHasZeroCap() public {
        require(guardedConsumer.collateralValue(address(this)) == 0, "Zero guarded value");
        require(guardedConsumer.maxBorrow(address(this)) == 0, "Zero guarded cap");
        vm.expectRevert(GuardedStockConsumer.BorrowExceedsCap.selector);
        guardedConsumer.borrow(1);
    }

    function testRepayBeyondDebtReverts() public {
        guardedConsumer.deposit(100e18);
        vm.expectRevert(GuardedStockConsumer.RepayExceedsDebt.selector);
        guardedConsumer.repay(1);
        vm.expectRevert(UnsafeStockConsumer.RepayExceedsDebt.selector);
        unsafeConsumer.repay(1);
    }

    function testInvalidConsumerConfigurationRejected() public {
        vm.expectRevert(UnsafeStockConsumer.InvalidConfiguration.selector);
        new UnsafeStockConsumer(address(0), address(token));
        vm.expectRevert(GuardedStockConsumer.InvalidConfiguration.selector);
        new GuardedStockConsumer(address(0));
    }

    function testFuzzGuardedIgnoresMultiplier(uint64 multiplier) public {
        vm.assume(multiplier > 0);
        token.setState(false, uint256(multiplier) + 1);
        guardedConsumer.deposit(1e18);
        require(guardedConsumer.collateralValue(address(this)) == 100e18, "Multiplier leaked");
    }
}
