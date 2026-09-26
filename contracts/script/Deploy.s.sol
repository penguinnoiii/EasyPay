// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploys MockUSDC + PaymentRouter to Fuji, allowlists AVAX + MockUSDC,
/// and writes the resulting addresses to packages/shared/addresses.fuji.json.
contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address quoteSigner = vm.addr(vm.envUint("QUOTE_SIGNER_PRIVATE_KEY"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPk);

        MockUSDC usdc = new MockUSDC();
        PaymentRouter router = new PaymentRouter(deployer, quoteSigner, treasury);
        router.setTokenAllowed(address(0), true);
        router.setTokenAllowed(address(usdc), true);

        vm.stopBroadcast();

        console.log("PaymentRouter:", address(router));
        console.log("MockUSDC:", address(usdc));
        console.log("Treasury:", treasury);
        console.log("QuoteSigner:", quoteSigner);

        string memory objectKey = "addresses";
        vm.serializeUint(objectKey, "chainId", block.chainid);
        vm.serializeAddress(objectKey, "paymentRouter", address(router));
        vm.serializeAddress(objectKey, "mockUSDC", address(usdc));
        vm.serializeAddress(objectKey, "treasury", treasury);
        vm.serializeAddress(objectKey, "quoteSigner", quoteSigner);
        vm.serializeAddress(objectKey, "deployer", deployer);
        string memory finalJson = vm.serializeUint(objectKey, "deployedAtBlock", block.number);

        vm.writeJson(finalJson, "../packages/shared/addresses.fuji.json");
    }
}
