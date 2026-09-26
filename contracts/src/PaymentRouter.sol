// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Accepts a payment in AVAX or an allowlisted ERC-20 against a backend-signed
/// THB price quote, and forwards funds to the treasury for an off-chain PromptPay payout.
/// The contract trusts `quoteSigner` as the sole price oracle; it holds no on-chain price feed.
contract PaymentRouter is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    struct Quote {
        bytes32 quoteId;
        address payer;
        address token;
        uint256 tokenAmount;
        uint256 thbSatang;
        uint16 feeBps;
        bytes32 merchantHash;
        uint64 expiry;
    }

    bytes32 public constant QUOTE_TYPEHASH = keccak256(
        "Quote(bytes32 quoteId,address payer,address token,uint256 tokenAmount,uint256 thbSatang,uint16 feeBps,bytes32 merchantHash,uint64 expiry)"
    );

    uint16 public constant MIN_FEE_BPS = 100;
    uint16 public constant MAX_FEE_BPS = 300;

    address public quoteSigner;
    address public treasury;

    mapping(address => bool) public tokenAllowed;
    mapping(bytes32 => bool) public used;

    event PaymentReceived(
        bytes32 indexed quoteId,
        address indexed payer,
        address token,
        uint256 tokenAmount,
        uint256 thbSatang,
        uint16 feeBps,
        bytes32 merchantHash
    );
    event QuoteSignerUpdated(address indexed newSigner);
    event TreasuryUpdated(address indexed newTreasury);
    event TokenAllowedUpdated(address indexed token, bool allowed);

    error InvalidSignature();
    error QuoteExpired();
    error QuoteAlreadyUsed();
    error NotPayer();
    error TokenNotAllowed();
    error FeeOutOfBounds();
    error WrongPayFunctionForToken();
    error IncorrectNativeAmount();
    error NativeTransferFailed();
    error ZeroAddress();

    constructor(address initialOwner, address _quoteSigner, address _treasury)
        Ownable(initialOwner)
        EIP712("PaymentRouter", "1")
    {
        if (_quoteSigner == address(0) || _treasury == address(0)) revert ZeroAddress();
        quoteSigner = _quoteSigner;
        treasury = _treasury;
    }

    function pay(Quote calldata q, bytes calldata sig) external nonReentrant whenNotPaused {
        if (q.token == address(0)) revert WrongPayFunctionForToken();
        _verifyAndConsume(q, sig);

        IERC20(q.token).safeTransferFrom(q.payer, treasury, q.tokenAmount);

        emit PaymentReceived(q.quoteId, q.payer, q.token, q.tokenAmount, q.thbSatang, q.feeBps, q.merchantHash);
    }

    function payNative(Quote calldata q, bytes calldata sig) external payable nonReentrant whenNotPaused {
        if (q.token != address(0)) revert WrongPayFunctionForToken();
        if (msg.value != q.tokenAmount) revert IncorrectNativeAmount();
        _verifyAndConsume(q, sig);

        (bool success,) = treasury.call{value: q.tokenAmount}("");
        if (!success) revert NativeTransferFailed();

        emit PaymentReceived(q.quoteId, q.payer, q.token, q.tokenAmount, q.thbSatang, q.feeBps, q.merchantHash);
    }

    function hashQuote(Quote calldata q) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                QUOTE_TYPEHASH,
                q.quoteId,
                q.payer,
                q.token,
                q.tokenAmount,
                q.thbSatang,
                q.feeBps,
                q.merchantHash,
                q.expiry
            )
        );
    }

    function _verifyAndConsume(Quote calldata q, bytes calldata sig) internal {
        if (msg.sender != q.payer) revert NotPayer();
        if (block.timestamp > q.expiry) revert QuoteExpired();
        if (used[q.quoteId]) revert QuoteAlreadyUsed();
        if (!tokenAllowed[q.token]) revert TokenNotAllowed();
        if (q.feeBps < MIN_FEE_BPS || q.feeBps > MAX_FEE_BPS) revert FeeOutOfBounds();

        bytes32 digest = _hashTypedDataV4(hashQuote(q));
        address signer = ECDSA.recover(digest, sig);
        if (signer != quoteSigner) revert InvalidSignature();

        used[q.quoteId] = true;
    }

    function setQuoteSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        quoteSigner = newSigner;
        emit QuoteSignerUpdated(newSigner);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        tokenAllowed[token] = allowed;
        emit TokenAllowedUpdated(token, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
