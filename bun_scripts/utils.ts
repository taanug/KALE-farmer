import { Keypair, Networks, scValToNative, SorobanRpc, xdr } from "@stellar/stellar-sdk";
import { AssembledTransaction, basicNodeSigner } from "@stellar/stellar-sdk/contract";
import type { Tx } from "@stellar/stellar-sdk/contract";
import { Client } from 'kale-sc-sdk';

interface Block {
    entropy: Buffer,
    pow_zeros: bigint,
    reclaimed: bigint,
    staked: bigint,
    timestamp: bigint,
}

export const rpc = new SorobanRpc.Server(Bun.env.RPC_URL!);
export const farmerSigner = basicNodeSigner(Keypair.fromSecret(Bun.env.FARMER_SK!), Networks.PUBLIC)

export const contract = new Client({
    rpcUrl: Bun.env.RPC_URL!,
    contractId: Bun.env.CONTRACT_ID!,
    networkPassphrase: Networks.PUBLIC
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

    return fetch(Bun.env.LAUNCHTUBE_URL!, {
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
    let index: number | undefined;
    let entropy: string | undefined;
    let timestamp: Date | undefined;

    try {
        await rpc.getContractData(
            Bun.env.CONTRACT_ID!,
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

        await rpc.getContractData(Bun.env.CONTRACT_ID!, xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol('Block'),
            xdr.ScVal.scvU32(Number(index))
        ]), SorobanRpc.Durability.Temporary)
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