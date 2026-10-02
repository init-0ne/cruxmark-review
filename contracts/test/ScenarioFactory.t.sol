// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "../src/PriceGuard.sol";
import {GuardedStockConsumer} from "../src/ScenarioConsumers.sol";
import {ScenarioFactory, ScenarioInstance} from "../src/ScenarioFactory.sol";

interface VmFactory {
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
}
