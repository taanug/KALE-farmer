import { Address, Keypair, scValToNative, xdr } from "@stellar/stellar-sdk/minimal";
import { AssembledTransaction, basicNodeSigner } from "@stellar/stellar-sdk/minimal/contract";
import type { Tx } from "@stellar/stellar-sdk/minimal/contract";
import { Durability, Server } from "@stellar/stellar-sdk/minimal/rpc";
import { Client } from 'kale-sc-sdk';
import { version } from './package.json';

const INDEX_filename = Bun.env.ENV === 'mainnet' ? '.INDEX' : '.INDEX.testnet';

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
            'X-Client-Name': 'rust-kale-farmer',
            'X-Client-Version': version
        },
        body: data
    }).then(async (res) => {
        if (res.ok)
            return res.json()
        else throw await res.text()
    })
}

export async function getIndex() {
    let index: number = 0;

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

            // if (key === 'FarmBlock') {
            //     console.log(
            //         'FarmBlock',
            //         scValToNative(entry.val())
            //     );
            // }
        })
    })

    return index;
}

export async function getBlock(index: number) {
    let block: Block | undefined;

    await rpc.getContractData(Bun.env.CONTRACT_ID, xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('Block'),
        xdr.ScVal.scvU32(Number(index))
    ]), Durability.Temporary)
        .then((res) => {
            log(
                // res.val.toXDR('base64')

                // 'Block key size', val.contractData().key().toXDR().length,
                // 'Block val size', val.contractData().val().toXDR().length

                // 'Key size', res.key.toXDR().length,
                // 'Val size', res.val.toXDR().length,

                // res.key.contractData().key().toXDR().length,
                // res.val.contractData().val().toXDR().length,
                // res.val.contractData().key().toXDR().length,
                // res.val.contractData().val().toXDR().length,
            );

            block = scValToNative(res.val.contractData().val())
        })

    return block
}

export async function getPail(index: number) {
    let pail: Pail | undefined;

    await rpc.getContractData(Bun.env.CONTRACT_ID, xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('Pail'),
        Address.fromString(Bun.env.FARMER_PK).toScVal(),
        xdr.ScVal.scvU32(Number(index))
    ]), Durability.Temporary)
        .then(({ val }) => {
            pail = scValToNative(val.contractData().val())
        })

    return pail
}

export async function getContractData() {
    let index: number = 0;
    let block: Block | undefined;
    let pail: Pail | undefined;

    try {
        index = await getIndex();
        block = await getBlock(index);
        pail = await getPail(index);
    }  catch (err){
      if(!pail){
        log("Fetching a new pail...")
      }
      else {
        logError("Error getting contract data", {err, index, block, pail})
      }
    }
    return { index, block, pail }
}

export async function readINDEX() {
    const file = Bun.file(INDEX_filename)

    if (await file.exists()) {
        return file.text().then((index) => Number(index ?? 0));
    } else {
        return 0;
    }
}

export async function writeINDEX(index: number) {
    return Bun.write(INDEX_filename, index.toString());
}

// New utility functions with side effects
export const log = (...args: unknown[]) => console.log(...args)//Bun.env.DEBUG === 'true' && console.log(...args);
export const logError = (...args: unknown[]) => console.log(...args)//Bun.env.DEBUG === 'true' && console.error(...args);
export const exit = (code: number) => process.exit(code);
export const spawn = (args: string[], onMessage: (message: unknown) => void) =>
  Bun.spawn(args, { ipc: onMessage, stdout: 'pipe' });
export const fetchAndLogLaunchTubeJWTInfo = async () => {
    const errorText = 'There was a problem fetching your LaunchTube JWT information';
    try {
        const response = await fetch(`${Bun.env.LAUNCHTUBE_URL}/info`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${Bun.env.LAUNCHTUBE_JWT}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            logError(errorText, response);
        }
        const data = await response.json();
        if (data?.credits) {
            const message = `LaunchTube Credits ${Number(data.credits / 10000000)} XLM`
            return message;
        } else {
            logError(errorText, data);
        }
    } catch (error) {
        logError(errorText, error);
    }
}

export const isBlockTimeGreater: CalculateTimeFn = (block, compareTo):boolean => {
    const timestamp = block?.timestamp ? new Date(Number(block.timestamp * BigInt(1000))) : new Date(0);
    const timeDifference = Date.now() - timestamp.getTime();
    return timeDifference >= compareTo;
}

export const reverseObjectKeys =  (obj:any)=>{
    let keys = Object.keys(obj);
    keys.reverse();
    let newObject:any = {};
    for (let key of keys) {
        newObject[key] = obj[key];
    }
    return newObject;
}

export const formatUptimeDate = (difference:number): string => {
    let years = Math.floor(difference / (1000 * 60 * 60 * 24 * 365));
    difference -= years * (1000 * 60 * 60 * 24 * 365);
    let days = Math.floor(difference / (1000 * 60 * 60 * 24));
    difference -= days * (1000 * 60 * 60 * 24);
    let hours = Math.floor(difference / (1000 * 60 * 60));
    difference -= hours * (1000 * 60 * 60);
    let minutes = Math.floor(difference / (1000 * 60));
    difference -= minutes * (1000 * 60);
    let seconds = Math.floor(difference / 1000);
    
    let styledYears = years ? years.toString().padStart(2, '0') + ':' : '';
    let styledDays = days ? days.toString().padStart(2, '0') + ':' : '';
    let styledHours = hours ? hours.toString().padStart(2, '0') + ':' : '';
    let styledMinutes = minutes ? minutes.toString().padStart(2, '0') + ':' : '00:';
    let styledSeconds = seconds.toString().padStart(2, '0')
    return `${styledYears}${styledDays}${styledHours}${styledMinutes}${styledSeconds}`;
}

export const getUptime = (startTime:number) => `${formatUptimeDate(Date.now() - startTime)}`;
export const getHarvestTime = (startTime:number) => `${formatUptimeDate(startTime - Date.now())}`;
export const sleep = async (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
}