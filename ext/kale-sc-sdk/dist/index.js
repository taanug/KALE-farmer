import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from '@stellar/stellar-sdk/minimal/contract';
if (typeof window !== 'undefined') {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || Buffer;
}
export const networks = {
    unknown: {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        contractId: "CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA",
    }
};
export const Errors = {
    1: { message: "HomesteadExists" },
    2: { message: "HomesteadMissing" },
    4: { message: "FarmPaused" },
    5: { message: "FarmNotPaused" },
    6: { message: "PlantAmountTooLow" },
    7: { message: "ZeroCountTooLow" },
    8: { message: "PailExists" },
    9: { message: "PailMissing" },
    10: { message: "WorkMissing" },
    11: { message: "BlockMissing" },
    12: { message: "BlockInvalid" },
    13: { message: "HashInvalid" },
    14: { message: "HarvestNotReady" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { farmer, asset }, 
    /** Options for initalizing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ farmer, asset }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAAAAAAAAFcGxhbnQAAAAAAAACAAAAAAAAAAZmYXJtZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
            "AAAAAAAAAAAAAAAEd29yawAAAAMAAAAAAAAABmZhcm1lcgAAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAAAAAAVub25jZQAAAAAAAAYAAAABAAAABA==",
            "AAAAAAAAAAAAAAAHaGFydmVzdAAAAAACAAAAAAAAAAZmYXJtZXIAAAAAABMAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAAL",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABmZhcm1lcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAARoYXNoAAAD7gAAACAAAAAA",
            "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAAAAAAAAA==",
            "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAAAAAAAAA==",
            "AAAAAAAAAAAAAAAMcmVtb3ZlX2Jsb2NrAAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAAMX19jaGVja19hdXRoAAAAAwAAAAAAAAASX3NpZ25hdHVyZV9wYXlsb2FkAAAAAAPuAAAAIAAAAAAAAAALX3NpZ25hdHVyZXMAAAAD6AAAA+oAAAAAAAAAAAAAAA5fYXV0aF9jb250ZXh0cwAAAAAD6gAAB9AAAAAHQ29udGV4dAAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAAZFcnJvcnMAAA==",
            "AAAABAAAAAAAAAAAAAAABkVycm9ycwAAAAAADQAAAAAAAAAPSG9tZXN0ZWFkRXhpc3RzAAAAAAEAAAAAAAAAEEhvbWVzdGVhZE1pc3NpbmcAAAACAAAAAAAAAApGYXJtUGF1c2VkAAAAAAAEAAAAAAAAAA1GYXJtTm90UGF1c2VkAAAAAAAABQAAAAAAAAARUGxhbnRBbW91bnRUb29Mb3cAAAAAAAAGAAAAAAAAAA9aZXJvQ291bnRUb29Mb3cAAAAABwAAAAAAAAAKUGFpbEV4aXN0cwAAAAAACAAAAAAAAAALUGFpbE1pc3NpbmcAAAAACQAAAAAAAAALV29ya01pc3NpbmcAAAAACgAAAAAAAAAMQmxvY2tNaXNzaW5nAAAACwAAAAAAAAAMQmxvY2tJbnZhbGlkAAAADAAAAAAAAAALSGFzaEludmFsaWQAAAAADQAAAAAAAAAPSGFydmVzdE5vdFJlYWR5AAAAAA4=",
            "AAAAAQAAAAAAAAAAAAAABUJsb2NrAAAAAAAACgAAAAAAAAAHZW50cm9weQAAAAPuAAAAIAAAAAAAAAAHbWF4X2dhcAAAAAAEAAAAAAAAAAltYXhfc3Rha2UAAAAAAAALAAAAAAAAAAltYXhfemVyb3MAAAAAAAAEAAAAAAAAAAdtaW5fZ2FwAAAAAAQAAAAAAAAACW1pbl9zdGFrZQAAAAAAAAsAAAAAAAAACW1pbl96ZXJvcwAAAAAAAAQAAAAAAAAAEG5vcm1hbGl6ZWRfdG90YWwAAAALAAAAAAAAAAxzdGFrZWRfdG90YWwAAAALAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
            "AAAAAQAAAAAAAAAAAAAABFBhaWwAAAAEAAAAAAAAAANnYXAAAAAD6AAAAAQAAAAAAAAACHNlcXVlbmNlAAAABAAAAAAAAAAFc3Rha2UAAAAAAAALAAAAAAAAAAV6ZXJvcwAAAAAAA+gAAAAE",
            "AAAAAgAAAAAAAAAAAAAAB1N0b3JhZ2UAAAAABwAAAAAAAAAAAAAAC0hvbWVzdGVhZGVyAAAAAAAAAAAAAAAADkhvbWVzdGVhZEFzc2V0AAAAAAAAAAAAAAAAAAlGYXJtSW5kZXgAAAAAAAAAAAAAAAAAAAlGYXJtQmxvY2sAAAAAAAAAAAAAAAAAAApGYXJtUGF1c2VkAAAAAAABAAAAAAAAAAVCbG9jawAAAAAAAAEAAAAEAAAAAQAAAAAAAAAEUGFpbAAAAAIAAAATAAAABA=="]), options);
        this.options = options;
    }
    fromJSON = {
        plant: (this.txFromJSON),
        work: (this.txFromJSON),
        harvest: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        pause: (this.txFromJSON),
        unpause: (this.txFromJSON),
        remove_block: (this.txFromJSON)
    };
}
