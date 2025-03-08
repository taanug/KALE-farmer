build:
	cargo build --release

bindings-testnet:
	stellar contract bindings typescript --contract-id CCQLTKBVXU4IG2K3ZYRTC4IM5KT66U6MHKRVW77LLUKNYDZXVTIKA66A --network testnet --output-dir ./ext/kale-sc-sdk__raw --overwrite

bindings-mainnet:
	stellar contract bindings typescript --contract-id CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA --network mainnet --output-dir ./ext/kale-sc-sdk__raw --overwrite