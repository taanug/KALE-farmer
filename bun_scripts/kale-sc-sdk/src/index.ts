import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  unknown: {
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA",
  }
} as const

export const Errors = {
  1: {message:"AlreadyDiscovered"},

  2: {message:"HomesteadNotFound"},

  3: {message:"PailAmountTooLow"},

  4: {message:"AlreadyHasPail"},

  5: {message:"FarmIsPaused"},

  6: {message:"HashIsInvalid"},

  7: {message:"BlockNotFound"},

  8: {message:"HarvestNotReady"},

  9: {message:"KaleNotFound"},

  10: {message:"PailNotFound"},

  11: {message:"ZeroCountTooLow"},

  12: {message:"AssetAdminMismatch"},

  13: {message:"FarmIsNotPaused"}
}

export interface Block {
  entropy: Buffer;
  pow_zeros: i128;
  reclaimed: u64;
  staked: u64;
  timestamp: u64;
}

export type Storage = {tag: "Homesteader", values: void} | {tag: "HomesteadAsset", values: void} | {tag: "FarmIndex", values: void} | {tag: "FarmEntropy", values: void} | {tag: "FarmPaused", values: void} | {tag: "Block", values: readonly [u32]} | {tag: "Pail", values: readonly [string, u32]};


export interface Client {
  /**
   * Construct and simulate a plant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  plant: ({farmer, amount}: {farmer: string, amount: i128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a work transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  work: ({farmer, hash, nonce}: {farmer: string, hash: Buffer, nonce: u128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a harvest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  harvest: ({farmer, index}: {farmer: string, index: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a homestead transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  homestead: ({farmer, asset}: {farmer: string, asset: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({hash}: {hash: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAFcGxhbnQAAAAAAAACAAAAAAAAAAZmYXJtZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAEd29yawAAAAMAAAAAAAAABmZhcm1lcgAAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAAAAAAVub25jZQAAAAAAAAoAAAAA",
        "AAAAAAAAAAAAAAAHaGFydmVzdAAAAAACAAAAAAAAAAZmYXJtZXIAAAAAABMAAAAAAAAABWluZGV4AAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAJaG9tZXN0ZWFkAAAAAAAAAgAAAAAAAAAGZmFybWVyAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAARoYXNoAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAAAAAAAAA==",
        "AAAABAAAAAAAAAAAAAAABkVycm9ycwAAAAAADQAAAAAAAAARQWxyZWFkeURpc2NvdmVyZWQAAAAAAAABAAAAAAAAABFIb21lc3RlYWROb3RGb3VuZAAAAAAAAAIAAAAAAAAAEFBhaWxBbW91bnRUb29Mb3cAAAADAAAAAAAAAA5BbHJlYWR5SGFzUGFpbAAAAAAABAAAAAAAAAAMRmFybUlzUGF1c2VkAAAABQAAAAAAAAANSGFzaElzSW52YWxpZAAAAAAAAAYAAAAAAAAADUJsb2NrTm90Rm91bmQAAAAAAAAHAAAAAAAAAA9IYXJ2ZXN0Tm90UmVhZHkAAAAACAAAAAAAAAAMS2FsZU5vdEZvdW5kAAAACQAAAAAAAAAMUGFpbE5vdEZvdW5kAAAACgAAAAAAAAAPWmVyb0NvdW50VG9vTG93AAAAAAsAAAAAAAAAEkFzc2V0QWRtaW5NaXNtYXRjaAAAAAAADAAAAAAAAAAPRmFybUlzTm90UGF1c2VkAAAAAA0=",
        "AAAAAQAAAAAAAAAAAAAABUJsb2NrAAAAAAAABQAAAAAAAAAHZW50cm9weQAAAAPuAAAAIAAAAAAAAAAJcG93X3plcm9zAAAAAAAACwAAAAAAAAAJcmVjbGFpbWVkAAAAAAAABgAAAAAAAAAGc3Rha2VkAAAAAAAGAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAgAAAAAAAAAAAAAAB1N0b3JhZ2UAAAAABwAAAAAAAAAAAAAAC0hvbWVzdGVhZGVyAAAAAAAAAAAAAAAADkhvbWVzdGVhZEFzc2V0AAAAAAAAAAAAAAAAAAlGYXJtSW5kZXgAAAAAAAAAAAAAAAAAAAtGYXJtRW50cm9weQAAAAAAAAAAAAAAAApGYXJtUGF1c2VkAAAAAAABAAAAAAAAAAVCbG9jawAAAAAAAAEAAAAEAAAAAQAAAAAAAAAEUGFpbAAAAAIAAAATAAAABA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    plant: this.txFromJSON<null>,
        work: this.txFromJSON<null>,
        harvest: this.txFromJSON<null>,
        homestead: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        pause: this.txFromJSON<null>,
        unpause: this.txFromJSON<null>
  }
}