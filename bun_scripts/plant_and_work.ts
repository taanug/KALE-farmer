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

// Types
interface ContractData {
  index: number;
  block: Block | undefined;
  pail: Pail | undefined;
}

// State
let contractData: ContractData;
let proc: Subprocess<'ignore', 'pipe', 'inherit'> | undefined;
let prevIndex: number | undefined;
let booting = false;
let planted = false;
let worked = false;
let errors = 0;
let firstRun = true;
let timestamp = new Date(0);
let timeDiff = 0;
let minutes = 0;
let seconds = 0;

// Main execution
main();

function main() {
  run();
  setInterval(run, 5000);
}

async function run() {
  if (errors > 12) {
    console.log('Too many errors, exiting');
    process.exit(1);
  }

  if (firstRun || minutes >= 5) {
    if (!firstRun) console.log('Checking for a new block...');
    contractData = await getContractData();
  }

  const { index, block, pail } = contractData;
  const entropy =
    block?.entropy?.toString('hex') ?? Buffer.alloc(32).toString('hex');

  setTimeDiff(block);
  if (index !== prevIndex) {
    handleNewBlock(index, block, entropy, pail);
  } else {
    logStatus(index);
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

function handleNewBlock(
  index: number,
  block: Block | undefined,
  entropy: string,
  pail: Pail | undefined
) {
  console.log(
    firstRun
      ? `Farming KALE with ${Bun.env.FARMER_PK}`
      : 'New block of KALE seeds found!'
  );
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

  prevIndex = index;
  planted = !!(pail?.sequence || pail?.stake);
  worked = !!(pail?.gap || pail?.zeros);
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
}

function logStatus(index: number) {
  const timeStr = `${minutes}m ${seconds}s`;
  if (planted && worked) {
    console.log(`Done Farming ${index}, waiting for a new block...`, timeStr);
  } else if (planted && proc) {
    console.log(`Working ${index}...`, timeStr);
  } else if (planted) {
    console.log(`Growing ${index}...`, timeStr);
  } else {
    console.log(`Planting... ${index}`, timeStr);
  }
}

async function bootProc(index: number, entropy: string, timeDiff: number) {
  if (!planted) await plant();
  if (proc || worked || timeDiff < Number(Bun.env.WORK_WAIT_TIME)) return;

  console.log('Starting work...', `${minutes}m ${seconds}s`, errors);

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

  if (proc) await readStream(proc.stdout);
}

async function readStream(reader: ReadableStream<Uint8Array<ArrayBufferLike>>) {
  const value = await Bun.readableStreamToText(reader);
  if (!value) {
    console.log('NO VALUE');
    return;
  }

  Bun.write(Bun.stdout, value);

  try {
    const lastLine = value.trim().split('\n').pop();
    const [nonce, hash] = JSON.parse(lastLine!);
    const countZeros = hash.match(/^0*/)?.[0].length ?? 0;

    const at = await contract.work({
      farmer: Bun.env.FARMER_PK,
      hash: Buffer.from(hash, 'hex'),
      nonce: BigInt(nonce),
    });

    if (Api.isSimulationError(at.simulation!)) {
      handleWorkSimulationError(at.simulation.error);
    } else {
      await send(at);
      console.log('Successfully worked', at.result, countZeros);
      worked = true;
    }
  } catch {
    // Silent catch as errors are handled elsewhere
  }
}

function handleWorkSimulationError(error: string) {
  if (error.includes('Error(Contract, #7)')) {
    console.log('Already worked');
  } else {
    console.error('Work Error:', error);
    errors++;
  }
}

async function plant() {
  const at = await contract.plant({
    farmer: Bun.env.FARMER_PK,
    amount: errors ? 0n : BigInt(Bun.env.STAKE_AMOUNT),
  });

  if (Api.isSimulationError(at.simulation!)) {
    handlePlantSimulationError(at.simulation.error);
  } else {
    await at.signAuthEntries({
      address: Bun.env.FARMER_PK,
      signAuthEntry: farmerSigner.signAuthEntry,
    });
    await send(at);
    console.log('Successfully planted', Number(Bun.env.STAKE_AMOUNT) / 1e7);
    planted = true;
  }
}

function handlePlantSimulationError(error: string) {
  if (error.includes('Error(Contract, #8)')) {
    console.log('Already planted');
  } else {
    console.error('Plant Error:', error);
    errors++;
  }
}

function setTimeDiff(block: Block | undefined) {
  timestamp = block?.timestamp
    ? new Date(Number(block.timestamp * BigInt(1000)))
    : new Date(0);
  timeDiff = new Date().getTime() - timestamp.getTime();
  minutes = Math.floor(timeDiff / 60000);
  seconds = Math.floor((timeDiff % 60000) / 1000);
}
