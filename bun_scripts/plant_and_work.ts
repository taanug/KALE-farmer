import type { Subprocess } from 'bun';
import { $ } from 'bun';
import { contract, farmerSigner, getContractData, send, } from './utils';

import { Keypair, SorobanRpc } from '@stellar/stellar-sdk'

const STAKE_AMOUNT = '0_0100000'
const ZERO_COUNT = 7;

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

    const { index, entropy, timestamp } = await getContractData()

    const timeDiff = timestamp ? timestamp.getTime() - new Date().getTime() : 0;
    const minutes = Math.floor(Math.abs(timeDiff) / 60000);
    const seconds = Math.floor((Math.abs(timeDiff) % 60000) / 1000);
    console.log('Running...', `${minutes}m ${seconds}s`);

    if (index !== prev_index) {
        console.log(index, entropy);

        if (proc) {
            proc.kill()
            proc = undefined
        }

        prev_index = index
        planted = false
        worked = false
        errors = 0

        Bun.spawn(["bun", "harvest.ts"], {
            ipc(message) {
                console.log(message);
            },
        });
    }

    if (index && entropy && !proc) {
        await bootProc(index, entropy)
    }

    await Bun.sleep(5000)

    run()
}

async function bootProc(index: number, entropy: string) {
    console.log('Booting...');

    if (!planted) {
        // TODO lookup Pail storage item before calling the below
        // TODO more dynamic stake amount

        const at = await contract.plant({
            farmer: Bun.env.FARMER_PK!,
            amount: BigInt(STAKE_AMOUNT.replace(/\D/gm, ''))
        })

        if (SorobanRpc.Api.isSimulationError(at.simulation!)) {
            if (at.simulation.error.includes('Error(Contract, #4)')) {
                console.log('Already planted');
            } else {
                errors++
                return;
            }
        } else {
            await at.signAuthEntries({
                publicKey: Bun.env.FARMER_PK!,
                signAuthEntry: farmerSigner.signAuthEntry
            })

            await send(at)

            console.log('Successfully planted');
        }

        planted = true;
    }

    if (proc || worked)
        return

    // TODO once 7 succeeds try for 8

    proc = Bun.spawn([
        '../target/release/kale-farmer',
        '--farmer-hex', Keypair.fromPublicKey(Bun.env.FARMER_PK!).rawPublicKey().toString('hex'),
        '--index', index.toString(),
        '--entropy-hex', entropy,
        '--min-zeros', ZERO_COUNT.toString()
    ], { stdout: 'pipe' })

    if (proc) {
        console.log('Proc booted', errors);
        const reader = proc.stdout.getReader();
        await readStream(reader);
    }
}

// TODO interrupt hashing if we get a new index

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

            // TODO lookup Pail storage item before calling the below

            const at = await contract.work({
                farmer: Bun.env.FARMER_PK!,
                hash: Buffer.from(hash, 'hex'),
                nonce: BigInt(nonce),
            })

            if (SorobanRpc.Api.isSimulationError(at.simulation!)) {
                if (at.simulation.error.includes('Error(Contract, #11)')) {
                    console.log('Already worked');
                } else {
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