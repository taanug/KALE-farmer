import * as dotenv from "dotenv";
dotenv.config();

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { contract, farmerSigner, getContractData, send } from './utils.ts';
import { Keypair } from '@stellar/stellar-sdk/minimal';
import { Api } from '@stellar/stellar-sdk/minimal/rpc';

// (node:86687) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`:
// --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));'
// (Use `node --trace-warnings ...` to show where the warning was created)
// (node:86687) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
// (Use `node --trace-deprecation ...` to show where the warning was created)

interface Block {
  entropy?: Buffer;
  timestamp?: bigint;
  normalized_total?: bigint;
  staked_total?: bigint;
}

interface Pail {
  sequence?: bigint;
  stake?: bigint;
  gap?: bigint;
  zeros?: bigint;
}

let contractData: { index: number, block: Block | undefined, pail: Pail | undefined };
let proc: ChildProcess | undefined;
let prev_index: number | undefined;
let planting = false;
let booting = false;
let planted = false;
let worked = false;
let errors = 0;

// Initialize and start
async function init() {
  contractData = await getContractData();
  run();

  setInterval(async () => {
    contractData = await getContractData();
    run();
  }, 5000);
}

async function run() {
  if (errors > 12) {
    console.log('Too many errors, exiting');
    process.exit(1);
  }

  let { index } = contractData;
  const { block, pail } = contractData;
  const entropy = block?.entropy ? block.entropy.toString('hex') : Buffer.alloc(32).toString('hex');
  const timestamp = block?.timestamp ? new Date(Number(block.timestamp * BigInt(1000))) : new Date(0);
  const timeDiff = new Date().getTime() - timestamp.getTime();

  if (index !== prev_index) {
    const blockCopy = { ...block };
    delete blockCopy?.timestamp;
    delete blockCopy?.entropy;
    delete blockCopy?.normalized_total;
    delete blockCopy?.staked_total;
    console.log(index, blockCopy, entropy, timestamp);

    if (proc) {
      proc.kill();
      proc = undefined;
    }

    prev_index = index;
    planted = !!pail?.sequence || !!pail?.stake;
    worked = !!pail?.gap || !!pail?.zeros;
    errors = 0;

    spawn('node', ["--loader", "ts-node/esm", "harvest.ts"], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: process.env
    })
    // .on('message', (message) => {
    //   console.log(message);
    // });
  } else {
    const minutes = Math.floor(timeDiff / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);

    console.log('Running...', `${minutes}m ${seconds}s`);
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

// TODO getting double book proc during work

async function bootProc(index: number, entropy: string, timeDiff: number) {
  if (!planted) {
    await plant();
  }

  if (proc || worked || timeDiff < 200000) // don't work till >= 4 minutes after block open
    return;

  console.log('Booting...', errors);

  proc = spawn(
    path.resolve('../target/release/kale-farmer'),
    [
      '--farmer-hex', Keypair.fromPublicKey(process.env.FARMER_PK!).rawPublicKey().toString('hex'),
      '--index', index.toString(),
      '--entropy-hex', entropy,
      '--nonce-count', process.env.NONCE_COUNT!.toString(),
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );

  if (proc) {
    console.log('Proc booted');
    proc.stdout?.on('data', async (data) => {
      process.stdout.write(data);
      try {
        const lines = data.toString().trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const [nonce, hash] = JSON.parse(lastLine);
        let countZeros = 0;

        for (const char of hash) {
          if (char === '0') {
            countZeros++;
          } else {
            break;
          }
        }

        const at = await contract.work({
          farmer: process.env.FARMER_PK!,
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
        if (proc) {
          proc.kill();
          proc = undefined;
        }
      } catch (error) {
        // Ignore parsing errors for non-JSON output
      }
    });

    proc.on('close', (code) => {
      console.log(`Process exited with code ${code}`);
      proc = undefined;
    });
  }
}

async function plant() {
  // TODO more dynamic stake amount
  const at = await contract.plant({
    farmer: process.env.FARMER_PK!,
    amount: errors ? 0n : BigInt(process.env.STAKE_AMOUNT || '0') // don't stake if there are errors
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
      address: process.env.FARMER_PK!,
      signAuthEntry: farmerSigner.signAuthEntry
    });

    await send(at);

    console.log('Successfully planted', Number(process.env.STAKE_AMOUNT || '0') / 1e7);
  }

  planted = true;
}

init().catch(console.error);