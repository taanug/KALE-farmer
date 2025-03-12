import type { Subprocess } from 'bun';
import {
  contract,
  farmerSigner,
  getContractData,
  send,
  type Block,
  type Pail,
} from './utils';
import { Keypair } from '@stellar/stellar-sdk/minimal';
import { Api } from '@stellar/stellar-sdk/minimal/rpc';

let contractData: {
  index: number;
  block: Block | undefined;
  pail: Pail | undefined;
};
let proc: Subprocess<'ignore', 'pipe', 'inherit'> | undefined;
let prev_index: number | undefined;
let booting = false;
let planted = false;
let worked = false;
let errors = 0;
let firstRun = true;
let timestamp = new Date(0);
let timeDiff = 0;
let minutes = 0;
let seconds = 0;

run();

setInterval(async () => {
  run();
}, 5000);

async function run() {
  if (errors > 12) {
    console.log('Too many errors, exiting');
    process.exit(1);
  }

  if (firstRun || minutes >= 5) {
    if (!firstRun) {
      console.log('Checking for a new block...');
    }
    contractData = await getContractData();
  }
  let { index, block, pail } = contractData;
  const entropy = block?.entropy
    ? block.entropy.toString('hex')
    : Buffer.alloc(32).toString('hex');

  setTimeDiff(block);
  if (index !== prev_index) {
    if (firstRun) {
      console.log(`Farming KALE with ${Bun.env.FARMER_PK}`);
    } else {
      console.log('New block of KALE seeds found!');
    }
    console.log(
      index,
      {
        max_gap: block?.max_gap,
        max_zeros: block?.max_zeros,
        min_gap: block?.min_gap,
        min_stake: block?.min_stake,
        min_zeros: block?.min_zeros,
      },
      entropy,
      timestamp
    );

    if (proc) {
      proc.kill();
      proc = undefined;
    }

    prev_index = index;
    planted = !!pail?.sequence || !!pail?.stake;
    worked = !!pail?.gap || !!pail?.zeros;
    errors = 0;

    if (!firstRun) {
      setTimeout(() => {
        Bun.spawn(['bun', 'harvest.ts'], {
          ipc(message) {
            console.log(message);
          },
        });
      }, 60000);
    }
    firstRun = false;
  } else {
    console.log(
      planted && worked
        ? `Done Farming ${index}, waiting for a new block...`
        : planted && proc
        ? `Working ${index}...`
        : planted
        ? `Growing ${index}...`
        : `Planting...  ${index}`,
      `${minutes}m ${seconds}s`
    );
  }

  if (!booting && !proc && (!planted || !worked)) {
    try {
      booting = true;
      await bootProc(index, entropy, timeDiff);
    } catch (err) {
      console.error('Boot Error:', err);
      errors++;
    } finally {
      booting = false;
    }
  }
}

async function bootProc(index: number, entropy: string, timeDiff: number) {
  if (!planted) {
    await plant();
  }

  if (proc || worked || timeDiff < Bun.env.WORK_WAIT_TIME)
    // don't work till >= 4 minutes after block open
    return;

  console.log('Starting work... ' + `${minutes}m ${seconds}s`, errors);

  proc = Bun.spawn(
    [
      '../target/release/kale-farmer',
      '--farmer-hex',
      Keypair.fromPublicKey(Bun.env.FARMER_PK).rawPublicKey().toString('hex'),
      '--index',
      index.toString(),
      '--entropy-hex',
      entropy,
      '--nonce-count',
      Bun.env.NONCE_COUNT.toString(),
    ],
    { stdout: 'pipe' }
  );

  if (proc) {
    await readStream(proc.stdout);
  }
}

async function readStream(reader: ReadableStream<Uint8Array<ArrayBufferLike>>) {
  const value = await Bun.readableStreamToText(reader);

  if (!value) {
    console.log('NO VALUE');
    return;
  }

  Bun.write(Bun.stdout, value);

  try {
    const lastLine = Buffer.from(value)
      .toString('utf-8')
      .trim()
      .split('\n')
      .pop();
    const [nonce, hash] = JSON.parse(lastLine!);
    let countZeros = 0;

    for (const char of hash) {
      if (char === '0') {
        countZeros++;
      } else {
        break;
      }
    }

    const at = await contract.work({
      farmer: Bun.env.FARMER_PK,
      hash: Buffer.from(hash, 'hex'),
      nonce: BigInt(nonce),
    });

    if (Api.isSimulationError(at.simulation!)) {
      if (at.simulation.error.includes('Error(Contract, #7)')) {
        console.log('Already worked');
      } else {
        console.error('Work Error:', at.simulation.error);
        errors++;
        return;
      }
    } else {
      await send(at);
      console.log('Successfully worked', at.result, countZeros);
    }

    worked = true;
  } catch {}
}

async function plant() {
  // TODO more dynamic stake amount

  const at = await contract.plant({
    farmer: Bun.env.FARMER_PK,
    amount: errors ? 0n : BigInt(Bun.env.STAKE_AMOUNT), // don't stake if there are errors
  });

  if (Api.isSimulationError(at.simulation!)) {
    if (at.simulation.error.includes('Error(Contract, #8)')) {
      console.log('Already planted');
    } else {
      console.error('Plant Error:', at.simulation.error);
      errors++;
      return;
    }
  } else {
    await at.signAuthEntries({
      address: Bun.env.FARMER_PK,
      signAuthEntry: farmerSigner.signAuthEntry,
    });

    await send(at);

    console.log('Successfully planted', Bun.env.STAKE_AMOUNT / 1e7);
  }

  planted = true;
}

function setTimeDiff(block: any) {
  timestamp = block?.timestamp
    ? new Date(Number(block.timestamp * BigInt(1000)))
    : new Date(0);

  timeDiff = new Date().getTime() - timestamp.getTime();
  minutes = Math.floor(timeDiff / 60000);
  seconds = Math.floor((timeDiff % 60000) / 1000);
}
