import { Keypair, scValToNative, xdr } from "@stellar/stellar-sdk";
import { AssembledTransaction, basicNodeSigner } from "@stellar/stellar-sdk/contract";
import type { Tx } from "@stellar/stellar-sdk/contract";
import { Durability, Server } from "@stellar/stellar-sdk/rpc";
import { Client } from 'kale-sc-sdk';

interface Block {
    timestamp: bigint,
    min_gap: bigint,
    min_stake: bigint,
    min_zeros: bigint,
    max_gap: bigint,
    max_stake: bigint,
    max_zeros: bigint,
    entropy: Buffer,
    staked_total: bigint,
    normalized_total: bigint,
}

export const rpc = new Server(Bun.env.RPC_URL);
export const farmerSigner = basicNodeSigner(Keypair.fromSecret(Bun.env.FARMER_SK), Bun.env.NETWORK_PASSPHRASE)

export const contract = new Client({
    rpcUrl: Bun.env.RPC_URL,
    contractId: Bun.env.CONTRACT_ID,
    networkPassphrase: Bun.env.NETWORK_PASSPHRASE,
})

export async function send<T>(txn: AssembledTransaction<T> | Tx | string, fee?: number) {
    const data = new FormData();

    if (txn instanceof AssembledTransaction) {
        txn = txn.built!.toXDR()
    } else if (typeof txn !== 'string') {
        txn = txn.toXDR()
    }

    data.set('xdr', txn);

    if (fee)
        data.set('fee', fee.toString());

    return fetch(Bun.env.LAUNCHTUBE_URL, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${Bun.env.LAUNCHTUBE_JWT}`,
        },
        body: data
    }).then(async (res) => {
        if (res.ok)
            return res.json()
        else throw await res.text()
    })
}

export async function getContractData() {
    let index: number = 0;
    let entropy: string = Buffer.alloc(32).toString('hex');
    let timestamp: Date = new Date(0);

    try {
        await rpc.getContractData(
            Bun.env.CONTRACT_ID,
            xdr.ScVal.scvLedgerKeyContractInstance()
        ).then(({ val }) =>
            val.contractData()
                .val()
                .instance()
                .storage()
        ).then((storage) => {
            return storage?.map((entry) => {
                const key: string = scValToNative(entry.key())[0]

                if (key === 'FarmIndex') {
                    index = entry.val().u32()
                }
            })
        })

        await rpc.getContractData(Bun.env.CONTRACT_ID, xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol('Block'),
            xdr.ScVal.scvU32(Number(index))
        ]), Durability.Temporary)
            .then(({ val }) => {
                const block: Block = scValToNative(val.contractData().val())
                entropy = block.entropy.toString('hex')
                timestamp = new Date(Number(block.timestamp * BigInt(1000)))
            })
    } catch (err) {
        console.error(err);
    }

    return { index, entropy, timestamp }
}