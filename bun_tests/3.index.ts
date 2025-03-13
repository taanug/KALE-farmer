import { Address, xdr } from '@stellar/stellar-sdk';
import { rpc } from './utils'

const hasher = new Bun.CryptoHasher("sha256");
const code = await rpc.getContractWasmByContractId(Bun.env.CONTRACT_ID)
const instance = await rpc.getContractData(Bun.env.CONTRACT_ID, xdr.ScVal.scvLedgerKeyContractInstance())

let code_length = 0;
let instance_length = 0;
let block_length = 0;
let pail_length = 0;

code_length += new xdr.LedgerEntry({
    lastModifiedLedgerSeq: 0,
    data: xdr.LedgerEntryData.contractCode(new xdr.ContractCodeEntry({
        hash: hasher.update(code).digest(),
        code,
        ext: new xdr.ContractCodeEntryExt(0),
    })),
    ext: new xdr.LedgerEntryExt(0),
}).toXDR().length;

// adds 8
// code_length += xdr.LedgerEntryData.contractCode(new xdr.ContractCodeEntry({
//     hash: hasher.update(code).digest(),
//     code,
//     ext: new xdr.ContractCodeEntryExt(0),
// })).toXDR().length;

// code_length += code.length;

instance_length += new xdr.LedgerEntry({
    lastModifiedLedgerSeq: 0,
    data: xdr.LedgerEntryData.contractData(new xdr.ContractDataEntry({
        contract: Address.fromString(Bun.env.CONTRACT_ID).toScAddress(),
        key: instance.key.contractData().key(),
        val: instance.val.contractData().val(),
        durability: xdr.ContractDataDurability.persistent(),
        ext: new xdr.ExtensionPoint(0),
    })),
    ext: new xdr.LedgerEntryExt(0),
}).toXDR().length;

// instance_length += instance.val.contractData().toXDR().length;

// instance_length += instance.val.contractData().val().toXDR().length; // .val().toXDR().length;

// await rpc.getContractData(Bun.env.CONTRACT_ID, xdr.ScVal.scvVec([
//     xdr.ScVal.scvSymbol('Block'),
//     xdr.ScVal.scvU32(0)
// ]), Durability.Temporary)
//     .then((res) => {
        
//     })

// await rpc.getContractData(Bun.env.CONTRACT_ID, xdr.ScVal.scvVec([
//     xdr.ScVal.scvSymbol('Pail'),
//     Address.fromString('CDNPYK7GFKYL5VLBUFY2U33W46XEEZ77ZSBG2WV6MRF4GZ6LXS6Z67WS').toScVal(),
//     xdr.ScVal.scvU32(31978)
// ]), Durability.Temporary)
//     .then((res) => {
//         console.log(res.val.contractData().toXDR('base64'));
//     })

// block_length += new xdr.LedgerEntry({
//     lastModifiedLedgerSeq: 0,
//     data: xdr.LedgerEntryData.contractData(new xdr.ContractDataEntry({
//         contract: Address.fromString(Bun.env.CONTRACT_ID).toScAddress(),
//         key: xdr.ScVal.scvVec([
//             xdr.ScVal.scvSymbol('Block'),
//             xdr.ScVal.scvU32(0)
//         ]),
//         val: xdr.ScVal.scvVoid(),
//         // val: xdr.ScVal.scvMap([
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('timestamp'),
//         //         val: xdr.ScVal.scvU64(new xdr.Uint64(0))
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('min_gap'),
//         //         val: xdr.ScVal.scvU32(0)
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('min_stake'),
//         //         val: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(0) }))
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('min_zeros'),
//         //         val: xdr.ScVal.scvU32(0)
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('max_gap'),
//         //         val: xdr.ScVal.scvU32(0)
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('max_stake'),
//         //         val: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(0) }))
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('max_zeros'),
//         //         val: xdr.ScVal.scvU32(0)
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('entropy'),
//         //         val: xdr.ScVal.scvBytes(Buffer.alloc(32))
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('staked_total'),
//         //         val: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(0) }))
//         //     }),
//         //     new xdr.ScMapEntry({
//         //         key: xdr.ScVal.scvSymbol('normalized_total'),
//         //         val: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(0) }))
//         //     }),
//         // ]),
//         durability: xdr.ContractDataDurability.temporary(),
//         ext: new xdr.ExtensionPoint(0),
//     })),
//     ext: new xdr.LedgerEntryExt(0),
// }).toXDR().length;

pail_length += new xdr.LedgerEntry({
    lastModifiedLedgerSeq: 0,
    data: xdr.LedgerEntryData.contractData(new xdr.ContractDataEntry({
        contract: Address.fromString(Bun.env.CONTRACT_ID).toScAddress(),
        key: xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol('Pail'),
            Address.fromString(Bun.env.FARMER_PK).toScVal(),
            xdr.ScVal.scvU32(0)
        ]),
        val: xdr.ScVal.scvVoid(),
        // val: xdr.ScVal.scvMap([
        //     new xdr.ScMapEntry({
        //         key: xdr.ScVal.scvSymbol('gap'),
        //         val: xdr.ScVal.scvVoid()
        //     }),
        //     new xdr.ScMapEntry({
        //         key: xdr.ScVal.scvSymbol('sequence'),
        //         val: xdr.ScVal.scvU32(0)
        //     }),
        //     new xdr.ScMapEntry({
        //         key: xdr.ScVal.scvSymbol('stake'),
        //         val: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(0) }))
        //     }),
        //     new xdr.ScMapEntry({
        //         key: xdr.ScVal.scvSymbol('zeros'),
        //         val: xdr.ScVal.scvVoid()
        //     }),
        // ]),
        durability: xdr.ContractDataDurability.temporary(),
        ext: new xdr.ExtensionPoint(0),
    })),
    ext: new xdr.LedgerEntryExt(0),
}).toXDR().length

// pail_length += xdr.LedgerEntryData.contractData(new xdr.ContractDataEntry({
//     contract: Address.fromString(Bun.env.CONTRACT_ID).toScAddress(),
//     key: xdr.ScVal.scvVec([
//         xdr.ScVal.scvSymbol('Pail'),
//         Address.fromString(Bun.env.FARMER_PK).toScVal(),
//         xdr.ScVal.scvU32(0)
//     ]),
//     val: xdr.ScVal.scvVoid(),
//     // val: xdr.ScVal.scvMap([
//     //     new xdr.ScMapEntry({
//     //         key: xdr.ScVal.scvSymbol('gap'),
//     //         val: xdr.ScVal.scvVoid()
//     //     }),
//     //     new xdr.ScMapEntry({
//     //         key: xdr.ScVal.scvSymbol('sequence'),
//     //         val: xdr.ScVal.scvU32(0)
//     //     }),
//     //     new xdr.ScMapEntry({
//     //         key: xdr.ScVal.scvSymbol('stake'),
//     //         val: xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(0) }))
//     //     }),
//     //     new xdr.ScMapEntry({
//     //         key: xdr.ScVal.scvSymbol('zeros'),
//     //         val: xdr.ScVal.scvVoid()
//     //     }),
//     // ]),
//     durability: xdr.ContractDataDurability.temporary(),
//     ext: new xdr.ExtensionPoint(0),
// })).toXDR().length;

// pail_length += xdr.ScVal.scvVec([
//     xdr.ScVal.scvSymbol('Pail'),
//     Address.fromString(Bun.env.FARMER_PK).toScVal(),
//     xdr.ScVal.scvU32(0)
// ]).toXDR().length;

let total = code_length + instance_length + block_length + pail_length;

console.log(
    `Code: ${code_length}`,
    `Instance: ${instance_length}`,
    `Block: ${block_length}`,
    `Pail: ${pail_length}`,
    `Total: ${total}`,
    20248 - total
);

// Needed: 20708
// Actual: 20248