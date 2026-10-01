// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PriceGuard} from "../src/PriceGuard.sol";
import {MockFeed, MockStockStatus} from "../src/mocks/MockInputs.sol";

interface VmDeploy {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeploySandbox {
    VmDeploy constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (PriceGuard guard, MockFeed price, MockFeed sequencer, MockStockStatus token)
    {
        require(
            block.chainid == 31337 || block.chainid == 46630 || block.chainid == 421614,
            "Test networks only"
        );
        require(block.timestamp > 3601, "Clock not initialized");
        vm.startBroadcast();
        price = new MockFeed(8);
        sequencer = new MockFeed(0);
        token = new MockStockStatus();
        price.setRound(100e8, block.timestamp, block.timestamp);
        sequencer.setRound(0, block.timestamp - 3601, block.timestamp);
        guard = new PriceGuard(address(price), address(sequencer), address(token), 300, 3600);
        vm.stopBroadcast();
    }
}
