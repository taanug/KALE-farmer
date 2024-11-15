build:
	RUSTFLAGS="-C target-cpu=native" cargo build --release

bindings-testnet:
	stellar contract bindings typescript --contract-id CDBG4XY2T5RRPH7HKGZIWMR2MFPLC6RJ453ITXQGNQXG6LNVL4375MRJ --network testnet --output-dir ./bun_scripts/kale-sc-sdk__raw --overwrite

bindings-mainnet:
	stellar contract bindings typescript --contract-id CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA --network mainnet --output-dir ./bun_scripts/kale-sc-sdk__raw --overwrite