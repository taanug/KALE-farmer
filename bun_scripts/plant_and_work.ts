import type { Subprocess } from 'bun';
import { contract, farmerSigner, getContractData, send } from './utils';
import { Keypair } from '@stellar/stellar-sdk'
import { Api } from '@stellar/stellar-sdk/rpc';

let proc: Subprocess<"ignore", "pipe", "inherit"> | undefined
let prev_index: number | undefined
let planted = false
let worked = false
let errors = 0

// TODO We have timestamps, we don't need to look every 5 seconds we can wait till the next block

run()

async function run() {
    if (errors > 10) {
        console.log('Too many errors, exiting');
        return
    }

    const { index, block, pail } = await getContractData();
    const entropy = block ? block.entropy.toString('hex') : Buffer.alloc(32).toString('hex');
    const timestamp = block ? new Date(Number(block.timestamp * BigInt(1000))) : new Date(0);

    const timeDiff = timestamp.getTime() - new Date().getTime();
    const minutes = Math.floor(Math.abs(timeDiff) / 60000);
    const seconds = Math.floor((Math.abs(timeDiff) % 60000) / 1000);

    console.log('Running...', `${minutes}m ${seconds}s`);

    if (index !== prev_index) {
        console.log(index, entropy, timestamp);

        if (proc) {
            proc.kill()
            proc = undefined
        }

        prev_index = index
        planted = !!pail?.sequence || !!pail?.stake
        worked = false // !!pail?.gap || !!pail?.zeros
        errors = 0

        Bun.spawn(["bun", "harvest.ts"], {
            ipc(message) {
                console.log(message);
            },
        });
    }

    if (!proc && (!planted || !worked)) {
        await bootProc(index, entropy)
    }

    await Bun.sleep(5000)

    run()
}

async function bootProc(index: number, entropy: string) {
    console.log('Booting...');

    if (!planted) {
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

            console.log('Successfully planted');
        }

        planted = true;
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
        console.log('Proc booted', errors);
        const reader = proc.stdout.getReader();
        await readStream(reader);
    }
}

// TODO interrupt hashing if we get a new index (right now we only look for the next index once current work is finished)

async function readStream(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>) {
    while (true) {
        const { done, value } = await reader.read();

        if (!value) {
            console.log('NO VALUE');
            break;
        }

        Bun.write(Bun.stdout, value);

        try {
            const [nonce, hash] = JSON.parse(Buffer.from(value).toString('utf-8'))

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
                console.log('Successfully worked');
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