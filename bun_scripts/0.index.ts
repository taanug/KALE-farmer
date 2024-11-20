import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';
import { rpc } from './utils';
import { Durability } from '@stellar/stellar-sdk/rpc';

let miner = Address.fromString('GDTLBABZ4NHAXUJAT2HIIQ52UDEBXXZLGB5QILBTCMSKEQENRM6PRIZ5').toScVal().toXDR().toJSON().data
let entropy = Buffer.from('AAAAwnpgwov7BoA88GL3ZcglWKYWcocWvQGq3YsEpSA=', 'base64').toJSON().data

console.log(`
    [${miner}],
    [${entropy}]
`);