## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy (Fuji)

Copy `.env.example` to `.env` and fill in `DEPLOYER_PRIVATE_KEY`, `QUOTE_SIGNER_PRIVATE_KEY`, `TREASURY_ADDRESS`. The deployer needs Fuji AVAX from https://core.app/tools/testnet-faucet/.

```shell
$ source .env
$ forge script script/Deploy.s.sol --rpc-url fuji --broadcast
```

This deploys `MockUSDC` and `PaymentRouter`, allowlists native AVAX + MockUSDC, and writes addresses to `../packages/shared/addresses.fuji.json`.

### Verify on Snowtrace

Fuji verification goes through Routescan's Etherscan-compatible API and accepts any non-empty placeholder API key for testnets.

```shell
$ forge verify-contract <ADDRESS> src/MockUSDC.sol:MockUSDC \
    --chain 43113 --verifier etherscan \
    --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
    --etherscan-api-key "verifyContract" --watch

# PaymentRouter needs ABI-encoded constructor args (initialOwner, quoteSigner, treasury):
$ cast abi-encode "constructor(address,address,address)" <OWNER> <QUOTE_SIGNER> <TREASURY>
$ forge verify-contract <ADDRESS> src/PaymentRouter.sol:PaymentRouter \
    --chain 43113 --verifier etherscan \
    --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
    --etherscan-api-key "verifyContract" \
    --constructor-args <ENCODED_ARGS> --watch
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
