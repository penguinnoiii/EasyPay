// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract PaymentRouterTest is Test {
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    PaymentRouter internal router;
    MockUSDC internal usdc;

    uint256 internal ownerPk = 0xA11CE;
    uint256 internal quoteSignerPk = 0xB0B;
    uint256 internal payerPk = 0xCAFE;
    uint256 internal strangerPk = 0xD00D;

    address internal owner;
    address internal quoteSigner;
    address internal payer;
    address internal stranger;
    address internal treasury = address(0xBEEF);

    function setUp() public {
        owner = vm.addr(ownerPk);
        quoteSigner = vm.addr(quoteSignerPk);
        payer = vm.addr(payerPk);
        stranger = vm.addr(strangerPk);

        vm.prank(owner);
        router = new PaymentRouter(owner, quoteSigner, treasury);

        usdc = new MockUSDC();

        vm.prank(owner);
        router.setTokenAllowed(address(usdc), true);
        vm.prank(owner);
        router.setTokenAllowed(address(0), true);
    }

    function _domainSeparator() internal view returns (bytes32) {
        (,string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            router.eip712Domain();
        return keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifyingContract)
        );
    }

    function _sign(PaymentRouter.Quote memory q, uint256 signerPk) internal view returns (bytes memory) {
        bytes32 structHash = router.hashQuote(q);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _baseQuote(address token, uint256 tokenAmount) internal view returns (PaymentRouter.Quote memory) {
        return PaymentRouter.Quote({
            quoteId: keccak256(abi.encodePacked("quote", token, tokenAmount, block.timestamp)),
            payer: payer,
            token: token,
            tokenAmount: tokenAmount,
            thbSatang: 10_000,
            feeBps: 150,
            merchantHash: keccak256("0812345678"),
            expiry: uint64(block.timestamp + 60)
        });
    }

    function test_PayErc20_Success() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.prank(payer);
        usdc.faucet();
        vm.prank(payer);
        usdc.approve(address(router), q.tokenAmount);

        vm.expectEmit(true, true, false, true);
        emit PaymentRouter.PaymentReceived(q.quoteId, q.payer, q.token, q.tokenAmount, q.thbSatang, q.feeBps, q.merchantHash);

        vm.prank(payer);
        router.pay(q, sig);

        assertEq(usdc.balanceOf(treasury), q.tokenAmount);
        assertTrue(router.used(q.quoteId));
    }

    function test_PayNative_Success() public {
        PaymentRouter.Quote memory q = _baseQuote(address(0), 1 ether);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.deal(payer, 1 ether);

        vm.prank(payer);
        router.payNative{value: 1 ether}(q, sig);

        assertEq(treasury.balance, 1 ether);
        assertTrue(router.used(q.quoteId));
    }

    function test_RevertWhen_QuoteExpired() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        q.expiry = uint64(block.timestamp);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.warp(block.timestamp + 61);

        vm.prank(payer);
        vm.expectRevert(PaymentRouter.QuoteExpired.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_QuoteIdReused() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.prank(payer);
        usdc.faucet();
        vm.prank(payer);
        usdc.approve(address(router), q.tokenAmount * 2);

        vm.prank(payer);
        router.pay(q, sig);

        vm.prank(payer);
        vm.expectRevert(PaymentRouter.QuoteAlreadyUsed.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_WrongSigner() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        bytes memory sig = _sign(q, strangerPk);

        vm.prank(payer);
        vm.expectRevert(PaymentRouter.InvalidSignature.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_WrongPayer() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.prank(stranger);
        vm.expectRevert(PaymentRouter.NotPayer.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_WrongNativeValue() public {
        PaymentRouter.Quote memory q = _baseQuote(address(0), 1 ether);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.deal(payer, 1 ether);

        vm.prank(payer);
        vm.expectRevert(PaymentRouter.IncorrectNativeAmount.selector);
        router.payNative{value: 0.5 ether}(q, sig);
    }

    function test_RevertWhen_FeeOutOfBounds() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        q.feeBps = 50;
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.prank(payer);
        vm.expectRevert(PaymentRouter.FeeOutOfBounds.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_TokenNotAllowed() public {
        MockUSDC other = new MockUSDC();
        PaymentRouter.Quote memory q = _baseQuote(address(other), 100e6);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.prank(payer);
        vm.expectRevert(PaymentRouter.TokenNotAllowed.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_Paused() public {
        vm.prank(owner);
        router.pause();

        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.pay(q, sig);
    }

    function test_RevertWhen_NonOwnerSetsQuoteSigner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.setQuoteSigner(stranger);
    }

    function test_RevertWhen_WrongPayFunctionForToken() public {
        PaymentRouter.Quote memory q = _baseQuote(address(usdc), 100e6);
        bytes memory sig = _sign(q, quoteSignerPk);

        vm.deal(payer, 100e6);
        vm.prank(payer);
        vm.expectRevert(PaymentRouter.WrongPayFunctionForToken.selector);
        router.payNative{value: 100e6}(q, sig);
    }
}
