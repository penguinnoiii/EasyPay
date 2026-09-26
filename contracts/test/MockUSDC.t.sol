// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal alice = address(0xA11CE);

    function setUp() public {
        usdc = new MockUSDC();
    }

    function test_Decimals() public view {
        assertEq(usdc.decimals(), 6);
    }

    function test_Faucet_MintsAndRateLimits() public {
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 100e6);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetOnCooldown.selector, block.timestamp + 1 days));
        usdc.faucet();
    }

    function test_Faucet_AllowedAgainAfterCooldown() public {
        vm.prank(alice);
        usdc.faucet();

        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 200e6);
    }
}
