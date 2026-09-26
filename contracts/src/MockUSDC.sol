// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet-only mock USDC (6 decimals) with a rate-limited public faucet.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 100e6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucetClaim;

    error FaucetOnCooldown(uint256 nextAvailableAt);

    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint256 last = lastFaucetClaim[msg.sender];
        if (last != 0 && block.timestamp < last + FAUCET_COOLDOWN) {
            revert FaucetOnCooldown(last + FAUCET_COOLDOWN);
        }
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
