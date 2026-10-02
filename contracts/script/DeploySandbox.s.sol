// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ScenarioFactory} from "../src/ScenarioFactory.sol";

interface VmDeploy {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploy only the isolated factory. Each user creates their own inputs
/// and consumers; no shared mutable mock deployment is needed.
contract DeploySandbox {
    VmDeploy constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ScenarioFactory factory) {
        require(
            block.chainid == 31337 || block.chainid == 46630 || block.chainid == 421614,
            "Test networks only"
        );
        vm.startBroadcast();
        factory = new ScenarioFactory();
        vm.stopBroadcast();
    }
}
