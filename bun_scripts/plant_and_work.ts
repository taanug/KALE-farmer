import type { Subprocess } from 'bun';
import { contract, farmerSigner, getContractData, send, type Block, type Pail } from './utils';
import { Keypair } from '@stellar/stellar-sdk'
import { Api } from '@stellar/stellar-sdk/rpc';

let contractData: { index: number, block: Block | undefined, pail: Pail | undefined }
let proc: Subprocess<"ignore", "pipe", "inherit"> | undefined
let prev_index: number | undefined
let planting = false
let booting = false
let planted = false
let worked = false
let errors = 0

// TODO We have timestamps, we don't need to look every 5 seconds we can wait till the next block

contractData = await getContractData()
run()

setInterval(async () => {
    contractData = await getContractData()
    run()
}, 5000)

async function run() {
    if (errors > 10) {
        console.log('Too many errors, exiting');
        process.exit(1);
    }

    // TODO might be able to slim up `getContractData` calls to only index until there's definitely a new block

    let { index } = contractData;
    const { block, pail } = contractData;
    const entropy = block?.entropy ? block.entropy.toString('hex') : Buffer.alloc(32).toString('hex');
    const timestamp = block?.timestamp ? new Date(Number(block.timestamp * BigInt(1000))) : new Date(0);
    const timeDiff = new Date().getTime() - timestamp.getTime();

    if (!planting && timeDiff > 300000) {
        planting = true;
        console.log('Preemptive planting');

        try {
            await plant()
        } finally {
            planting = false;
            return;
        }
    } 
    
    else if (index !== prev_index) {
        delete block?.timestamp;
        delete block?.entropy;
        delete block?.normalized_total;
        delete block?.staked_total;
        console.log(index, block, entropy, timestamp);

        if (proc) {
            proc.kill()
            proc = undefined
        }

        prev_index = index
        planted = !!pail?.sequence || !!pail?.stake
        worked = !!pail?.gap || !!pail?.zeros
        errors = 0

        Bun.spawn(["bun", "harvest.ts"], {
            ipc(message) {
                console.log(message);
            },
        });
    } 
    
    else {
        const minutes = Math.floor(timeDiff / 60000);
        const seconds = Math.floor((timeDiff % 60000) / 1000);

        console.log('Running...', `${minutes}m ${seconds}s`);
    }

    if (!booting && !proc && (!planted || !worked)) {
        try {
            booting = true;
            await bootProc(index, entropy)
        } catch (err) {
            console.error('Boot Error:', err);
            errors++
        } finally {
            booting = false;
        }
    }
}

async function bootProc(index: number, entropy: string) {
    console.log('Booting...', errors);

    if (!planted) {
        await plant()
    }

    if (proc || worked)
        return

    // TODO once set `Bun.env.ZERO_COUNT` succeeds try for N+1

    proc = Bun.spawn([
        '../target/release/kale-farmer',
        '--farmer-hex', Keypair.fromPublicKey(Bun.env.FARMER_PK).rawPublicKey().toString('hex'),
        '--index', index.toString(),
        '--entropy-hex', entropy,
        '--min-zeros', Bun.env.ZERO_COUNT.toString(),
    ], { stdout: 'pipe' })

    if (proc) {
        console.log('Proc booted');
        const reader = proc.stdout.getReader();
        await readStream(reader);
    }
}

async function readStream(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>) {
    while (true) {
        const { done, value } = await reader.read();

        if (!value) {
            console.log('NO VALUE'); // TODO seeing this too much atm and not seeing successfully worked
            break;
        }

        Bun.write(Bun.stdout, value);

        try {
            const lastLine = Buffer.from(value).toString('utf-8').trim().split('\n').pop();
            const [nonce, hash] = JSON.parse(lastLine!);

            const at = await contract.work({
                farmer: Bun.env.FARMER_PK,
                hash: Buffer.from(hash, 'hex'),
                nonce: BigInt(nonce),
            })

            if (Api.isSimulationError(at.simulation!)) {
                if (at.simulation.error.includes('Error(Contract, #7)')) {
                    console.log('Already worked');
                } else {
                    console.error('Work Error:', at.simulation.error);
                    errors++
                    return;
                }
            } else {
                await send(at)
                console.log('Successfully worked', at.result);
            }

            worked = true;

            break;
        } catch { }

        if (done) {
            console.log('DONE');
            break;
        }
    }
}

async function plant() {
    // TODO more dynamic stake amount

    const at = await contract.plant({
        farmer: Bun.env.FARMER_PK,
        amount: BigInt(Bun.env.STAKE_AMOUNT)
    })

    if (Api.isSimulationError(at.simulation!)) {
        if (at.simulation.error.includes('Error(Contract, #8)')) {
            console.log('Already planted');
        } else {
            console.error('Plant Error:', at.simulation.error);
            errors++
            return;
        }
    } else {
        await at.signAuthEntries({
            // address: Bun.env.FARMER_PK,
            publicKey: Bun.env.FARMER_PK,
            signAuthEntry: farmerSigner.signAuthEntry
        })

        await send(at)

        console.log('Successfully planted', Bun.env.STAKE_AMOUNT / 1e7);
    }

    planted = true;
}