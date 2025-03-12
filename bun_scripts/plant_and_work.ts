import { contract, farmerSigner, getContractData, send } from './utils';
import { Keypair } from '@stellar/stellar-sdk/minimal';
import { Api } from '@stellar/stellar-sdk/minimal/rpc';
import type {
  ContractData,
  FarmerProcess,
  MainFn,
  RunFn,
  HandleNewBlockFn,
  LogStatusFn,
  BootProcFn,
  ReadStreamFn,
  HandleWorkSimulationErrorFn,
  PlantFn,
  HandlePlantSimulationErrorFn,
  SetTimeDiffFn,
} from './types';

// State
let contractData: ContractData;
let proc: FarmerProcess | undefined;
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

// Constants
const MAX_ERRORS = 12;
const CHECK_INTERVAL = 5000; // 5 seconds
const HARVEST_DELAY = 60000; // 1 minute

// Main execution
const main: MainFn = () => {
  void run(); // Initial run
  setInterval(() => void run(), CHECK_INTERVAL);
};

const run: RunFn = async () => {
  if (errors > MAX_ERRORS) {
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
    booting = true;
    try {
      await bootProc(index, entropy, timeDiff);
    } catch (err) {
      console.error('Boot Error:', err);
      errors++;
    } finally {
      booting = false;
    }
  }
};

const handleNewBlock: HandleNewBlockFn = (index, block, entropy, pail) => {
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

  proc?.kill();
  proc = undefined;

  prevIndex = index;
  planted = !!(pail?.sequence || pail?.stake);
  worked = !!(pail?.gap || pail?.zeros);
  errors = 0;

  if (!firstRun) {
    setTimeout(() => {
      Bun.spawn(['bun', 'harvest.ts'], {
        ipc: (message) => console.log(message),
      });
    }, HARVEST_DELAY);
  }
  firstRun = false;
};

const logStatus: LogStatusFn = (index) => {
  const timeStr = `${minutes}m ${seconds}s`;
  const status =
    planted && worked
      ? `Done Farming ${index}, waiting for a new block...`
      : planted && proc
      ? `Working ${index}...`
      : planted
      ? `Growing ${index}...`
      : `Planting... ${index}`;
  console.log(status, timeStr);
};

const bootProc: BootProcFn = async (index, entropy, timeDiff) => {
  if (!planted) await plant();
  if (proc || worked || timeDiff < Number(Bun.env.WORK_WAIT_TIME)) return;

  console.log('Starting work...', `${minutes}m ${seconds}s`, errors);

  proc = Bun.spawn(
    [
      '../target/release/kale-farmer',
      '--farmer-hex',
      Keypair.fromPublicKey(Bun.env.FARMER_PK).rawPublicKey().toString('hex'),
      '--index',
      String(index),
      '--entropy-hex',
      entropy,
      '--nonce-count',
      String(Bun.env.NONCE_COUNT),
    ],
    { stdout: 'pipe' }
  );

  if (proc.stdout) await readStream(proc.stdout);
};

const readStream: ReadStreamFn = async (reader) => {
  const value = await Bun.readableStreamToText(reader);
  if (!value) {
    console.log('NO VALUE');
    return;
  }

  await Bun.write(Bun.stdout, value);

  try {
    const lastLine = value.trim().split('\n').pop();
    if (!lastLine) return;

    const [nonce, hash] = JSON.parse(lastLine);
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
  } catch (err) {
    // Silent catch as errors are handled elsewhere
  }
};

const handleWorkSimulationError: HandleWorkSimulationErrorFn = (error) => {
  if (error.includes('Error(Contract, #7)')) {
    console.log('Already worked');
  } else {
    console.error('Work Error:', error);
    errors++;
  }
};

const plant: PlantFn = async () => {
  const at = await contract.plant({
    farmer: Bun.env.FARMER_PK,
    amount: errors ? 0n : BigInt(Bun.env.STAKE_AMOUNT || 0),
  });

  if (Api.isSimulationError(at.simulation!)) {
    handlePlantSimulationError(at.simulation.error);
  } else {
    await at.signAuthEntries({
      address: Bun.env.FARMER_PK,
      signAuthEntry: farmerSigner.signAuthEntry,
    });
    await send(at);
    console.log(
      'Successfully planted',
      Number(Bun.env.STAKE_AMOUNT || 0) / 1e7
    );
    planted = true;
  }
};

const handlePlantSimulationError: HandlePlantSimulationErrorFn = (error) => {
  if (error.includes('Error(Contract, #8)')) {
    console.log('Already planted');
  } else {
    console.error('Plant Error:', error);
    errors++;
  }
};

const setTimeDiff: SetTimeDiffFn = (block) => {
  timestamp = block?.timestamp
    ? new Date(Number(block.timestamp * BigInt(1000)))
    : new Date(0);
  timeDiff = Date.now() - timestamp.getTime();
  minutes = Math.floor(timeDiff / 60000);
  seconds = Math.floor((timeDiff % 60000) / 1000);
};

// Start the program
main();
