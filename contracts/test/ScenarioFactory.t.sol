// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "../src/PriceGuard.sol";
import {GuardedStockConsumer} from "../src/ScenarioConsumers.sol";
import {ScenarioFactory, ScenarioInstance} from "../src/ScenarioFactory.sol";

interface VmFactory {
    function chainId(uint256) external;
    function warp(uint256) external;
    function expectRevert(bytes calldata) external;
    function expectRevert(bytes4) external;
    function prank(address) external;
}

contract ScenarioFactoryTest {
    VmFactory constant vm = VmFactory(address(uint160(uint256(keccak256("hevm cheat code")))));

    ScenarioFactory factory;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        vm.warp(10_000);
        factory = new ScenarioFactory();
    }

    function testFactoryRejectsUnsupportedChains() public {
        vm.chainId(1);
        vm.expectRevert(bytes("Test networks only"));
        new ScenarioFactory();
        vm.chainId(1337);
        vm.expectRevert(bytes("Test networks only"));
        new ScenarioFactory();
        vm.chainId(421614);
        new ScenarioFactory();
        vm.chainId(46630);
        new ScenarioFactory();
    }

    function testCreateScenarioIsolatesOwners() public {
        vm.prank(ALICE);
        ScenarioInstance alice = factory.createScenario();
        vm.prank(BOB);
        ScenarioInstance bob = factory.createScenario();

        require(alice.owner() == ALICE, "Alice ownership");
        require(bob.owner() == BOB, "Bob ownership");
        require(address(alice) != address(bob), "Instances must differ");
        require(address(alice.price()) != address(bob.price()), "Price inputs must differ");
        require(
            address(alice.unsafeConsumer()) != address(bob.unsafeConsumer()), "Consumers differ"
        );

        // Alice injects the split fault; Bob's sandbox stays healthy.
        vm.prank(ALICE);
        alice.setSplitMultiplier(2e18);
        require(alice.token().uiMultiplier() == 2e18, "Alice split not set");
        require(bob.token().uiMultiplier() == 1e18, "Bob polluted");

        // Bob cannot mutate Alice's recorded run.
        vm.prank(BOB);
        vm.expectRevert(bytes("Only scenario owner"));
        alice.setSplitMultiplier(1e18);
        vm.prank(ALICE);
        vm.expectRevert(bytes("Only scenario owner"));
        bob.setSplitMultiplier(2e18);
    }

    function testIsolatedSplitExecution() public {
        vm.prank(ALICE);
        ScenarioInstance alice = factory.createScenario();
        vm.prank(ALICE);
        alice.setSplitMultiplier(2e18);

        alice.unsafeConsumer().deposit(100e18);
        alice.guardedConsumer().deposit(100e18);
        require(alice.unsafeConsumer().collateralValue(address(this)) == 20_000e18, "Unsafe split");
        require(
            alice.guardedConsumer().collateralValue(address(this)) == 10_000e18, "Guarded split"
        );
        alice.unsafeConsumer().borrow(12_000e18);
        GuardedStockConsumer aliceGuarded = alice.guardedConsumer();
        vm.expectRevert(GuardedStockConsumer.BorrowExceedsCap.selector);
        aliceGuarded.borrow(12_000e18);
    }

    function testInstanceRejectsInvalidOwnerChainAndClock() public {
        vm.expectRevert(bytes("Invalid owner"));
        new ScenarioInstance(address(0));

        vm.chainId(1);
        vm.expectRevert(bytes("Test networks only"));
        new ScenarioInstance(ALICE);
        vm.chainId(31337);

        // The grace window needs a clock past 3601 to place a recovery before it.
        vm.warp(3601);
        vm.expectRevert(bytes("Clock not initialized"));
        new ScenarioInstance(ALICE);
        vm.warp(3602);
        ScenarioInstance edge = new ScenarioInstance(ALICE);
        require(edge.sequencer().startedAt() == 1, "Healthy recovery precedes the grace window");
    }

    function testConfigureRejectsUnknownFaultAndMultiplier() public {
        ScenarioInstance mine = factory.createScenario();
        (bool accepted,) =
            address(mine).call(abi.encodeWithSignature("configureScenario(uint8)", 6));
        require(!accepted, "Unknown fault accepted");
        (accepted,) = address(mine).call(abi.encodeWithSignature("configureScenario(uint8)", 5));
        require(accepted, "Last fault rejected");

        vm.expectRevert(bytes("Invalid multiplier"));
        mine.setSplitMultiplier(0);
    }

    function testFactoryTracksPerUserScenarios() public {
        vm.prank(ALICE);
        ScenarioInstance first = factory.createScenario();
        vm.prank(ALICE);
        ScenarioInstance second = factory.createScenario();

        vm.prank(ALICE);
        address[] memory mine = factory.myScenarios();
        require(mine.length == 2, "Alice count");
        require(mine[0] == address(first), "First instance");
        require(mine[1] == address(second), "Second instance");
        require(factory.scenarioCount(ALICE) == 2, "Count view");
        require(factory.scenarios(ALICE, 0) == address(first), "Index view");
        require(factory.scenarioCount(BOB) == 0, "Bob must start empty");
    }

    function testOnlyOwnerCanMutateScenario() public {
        ScenarioInstance mine = factory.createScenario();
        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes("Only scenario owner"));
        mine.setTokenState(true, 1e18);
        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes("Only scenario owner"));
        mine.setPriceRound(100e8, 10_000, 10_000);
        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes("Only scenario owner"));
        mine.setSequencerRound(1, 10_000, 10_000);
    }

    function testSequencerDowntimeBlocksGuardedButNotUnsafe() public {
        ScenarioInstance mine = factory.createScenario();
        mine.unsafeConsumer().deposit(100e18);
        mine.guardedConsumer().deposit(100e18);

        mine.setSequencerRound(1, 10_000, 10_000);
        // Seeded fault ignores sequencer downtime entirely.
        mine.unsafeConsumer().borrow(6_000e18);
        GuardedStockConsumer guarded = mine.guardedConsumer();
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guarded.borrow(1);

        // Recovery after the grace window reopens the guarded path.
        mine.setSequencerRound(0, 10_000 - 3601, 10_000);
        vm.warp(10_001);
        guarded.borrow(6_000e18);
        require(guarded.debt(address(this)) == 6_000e18, "Recovery never opens");
    }

    function testAtomicFaultsClearPreviousInputsAndRefreshPrice() public {
        ScenarioInstance mine = factory.createScenario();
        mine.unsafeConsumer().deposit(100e18);
        mine.guardedConsumer().deposit(100e18);
        GuardedStockConsumer guarded = mine.guardedConsumer();
        mine.configureScenario(ScenarioInstance.Fault.Split);
        require(mine.unsafeConsumer().maxBorrow(address(this)) == 12_000e18, "Split cap");
        require(guarded.maxBorrow(address(this)) == 6_000e18, "Guarded cap");

        mine.configureScenario(ScenarioInstance.Fault.Paused);
        require(mine.token().uiMultiplier() == 1e18, "Previous split leaked");
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guarded.borrow(1);
        mine.unsafeConsumer().borrow(1);

        mine.configureScenario(ScenarioInstance.Fault.Stale);
        require(!mine.token().oraclePaused(), "Previous pause leaked");
        require(mine.price().updatedAt() == block.timestamp - 301, "Stale boundary");
        vm.expectRevert(PriceGuard.PriceUnavailable.selector);
        guarded.borrow(1);
        mine.unsafeConsumer().borrow(1);

        mine.configureScenario(ScenarioInstance.Fault.SequencerDown);
        require(mine.price().updatedAt() == block.timestamp, "Previous stale leaked");
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guarded.borrow(1);
        mine.unsafeConsumer().borrow(1);

        mine.configureScenario(ScenarioInstance.Fault.RecoveryGrace);
        require(mine.sequencer().answer() == 0, "Previous downtime leaked");
        vm.expectRevert(PriceGuard.SequencerUnavailable.selector);
        guarded.borrow(1);

        vm.warp(20_000);
        mine.configureScenario(ScenarioInstance.Fault.Healthy);
        require(mine.price().updatedAt() == 20_000, "Healthy did not refresh");
        guarded.borrow(1_000e18);
        mine.configureScenario(ScenarioInstance.Fault.Stale);
        guarded.repay(1_000e18);
        require(guarded.debt(address(this)) == 0, "Stale blocks repayment");
        guarded.deposit(1);
        mine.unsafeConsumer().repay(3);
        require(mine.unsafeConsumer().debt(address(this)) == 0, "Unsafe repayment");
    }

    function testConfigureRequiresOwnerAndDoesNotPolluteOtherRun() public {
        ScenarioInstance mine = factory.createScenario();
        vm.prank(BOB);
        ScenarioInstance other = factory.createScenario();
        vm.prank(BOB);
        vm.expectRevert(bytes("Only scenario owner"));
        mine.configureScenario(ScenarioInstance.Fault.Paused);
        mine.configureScenario(ScenarioInstance.Fault.Paused);
        require(!other.token().oraclePaused(), "Cross-run pause");
    }

    function testRepaymentAvailableDuringDownAndRecovery() public {
        ScenarioInstance mine = factory.createScenario();
        mine.guardedConsumer().deposit(100e18);
        mine.guardedConsumer().borrow(2_000e18);
        mine.configureScenario(ScenarioInstance.Fault.SequencerDown);
        mine.guardedConsumer().repay(1_000e18);
        mine.configureScenario(ScenarioInstance.Fault.RecoveryGrace);
        mine.guardedConsumer().repay(1_000e18);
        require(mine.guardedConsumer().debt(address(this)) == 0, "Recovery blocks repay");
    }
}
