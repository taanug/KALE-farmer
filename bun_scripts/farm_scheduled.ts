import type { Subprocess } from "bun";
import { contract, farmerSigner, getContractData, send } from "./utils";
import { Keypair } from "@stellar/stellar-sdk/minimal";
import { Api } from "@stellar/stellar-sdk/minimal/rpc";
import { harvestSingleBlock } from "./harvest";

// Constants for magic numbers
const WORK_DELAY_MINUTES = 4.5; //adjust this value to let kales ripen for more/less time
const CHECK_DELAY_MINUTES = 5;
const MAX_ERRORS = 12;
const RETRY_DELAY_MS = 5000;

// State management
interface FarmerState {
  workerProcess?: Subprocess<"ignore", "pipe", "inherit">;
  previousBlockIndex: number;
  isWorking: boolean;
  isPlanting: boolean;
  isPlanted: boolean;
  hasWorked: boolean;
  errorCount: number;
}

const state: FarmerState = {
  workerProcess: undefined,
  previousBlockIndex: 0,
  isWorking: false,
  isPlanting: false,
  isPlanted: false,
  hasWorked: false,
  errorCount: 0,
};

/**
 * Main function that orchestrates the farming process
 */
async function run(): Promise<void> {
  if (state.errorCount > MAX_ERRORS) {
    console.log("Too many errors, exiting");
    process.exit(1);
  }

  const { index, block, pail } = await getContractData();
  const entropy = block?.entropy
    ? block.entropy.toString("hex")
    : Buffer.alloc(32).toString("hex");

  // If there's a new block
  if (index !== state.previousBlockIndex) {
    console.log(` █  Found a new block at ${index}`);

    if (state.workerProcess) {
      state.workerProcess.kill();
      state.workerProcess = undefined;
    }

    state.isPlanted = !!pail?.sequence || !!pail?.stake;
    state.hasWorked = !!pail?.gap || !!pail?.zeros;
    state.errorCount = 0;

    if (!state.isPlanted && !state.isPlanting) await plant();
    await harvestSingleBlock(state.previousBlockIndex);
    state.previousBlockIndex = index;
  }

  // Check if there's time available to farm on this block
  if (
    block?.timestamp &&
    !state.isPlanted &&
    new Date().getTime() - blockTimestampToMs(block.timestamp) >= 4 * 60 * 1000
  ) {
    console.log("Not enough time to plant on this block.");
    scheduleNextCheck(block.timestamp);
    return;
  }

  if (!state.isPlanted && !state.isPlanting) await plant();

  if (block?.timestamp) {
    if (!state.hasWorked && !state.isWorking)
      scheduleWork(block.timestamp, index, entropy);

    scheduleNextCheck(block.timestamp);
  }
}

/**
 * Starts the worker process to perform farming work
 */
async function bootProc(index: number, entropy: string): Promise<void> {
  state.isWorking = true;

  console.log(" 🚜 Working...");

  state.workerProcess = Bun.spawn(
    [
      "../target/release/kale-farmer",
      "--farmer-hex",
      Keypair.fromPublicKey(Bun.env.FARMER_PK).rawPublicKey().toString("hex"),
      "--index",
      index.toString(),
      "--entropy-hex",
      entropy,
      "--nonce-count",
      Bun.env.NONCE_COUNT.toString(),
    ],
    { stdout: "pipe" },
  );

  if (state.workerProcess) {
    await readStream(state.workerProcess.stdout);
    state.isWorking = false;
  }
}

/**
 * Processes the output from the worker process
 */
async function readStream(
  reader: ReadableStream<Uint8Array<ArrayBufferLike>>,
): Promise<void> {
  const value = await Bun.readableStreamToText(reader);

  if (!value) {
    console.log("NO VALUE");
    return;
  }

  Bun.write(Bun.stdout, value);

  try {
    const lastLine = Buffer.from(value)
      .toString("utf-8")
      .trim()
      .split("\n")
      .pop();
    const [nonce, hash] = JSON.parse(lastLine!);
    let countZeros = 0;

    for (const char of hash) {
      if (char === "0") {
        countZeros++;
      } else {
        break;
      }
    }

    const transaction = await contract.work({
      farmer: Bun.env.FARMER_PK,
      hash: Buffer.from(hash, "hex"),
      nonce: BigInt(nonce),
    });

    if (Api.isSimulationError(transaction.simulation!)) {
      if (transaction.simulation.error.includes("Error(Contract, #7)")) {
        console.log("Already worked");
      } else {
        console.error("Work Error:", transaction.simulation.error);
        state.errorCount++;
        return;
      }
    } else {
      await send(transaction);
      console.log(
        ` 🚜 Nice work! Kales has been ripening for ${transaction.result} days, and you've found ${countZeros} magic seeds`,
      );
    }

    state.hasWorked = true;
  } catch (error) {
    // Added basic error logging instead of empty catch
    console.error("Error processing worker output:", error);
  }
}

/**
 * Plants seeds in the farm
 */
async function plant(): Promise<void> {
  state.isPlanting = true;
  console.log(" 🌱 Planting...");

  // TODO: dynamic stake amount
  const transaction = await contract.plant({
    farmer: Bun.env.FARMER_PK,
    amount: 0n,
  });

  if (Api.isSimulationError(transaction.simulation!)) {
    if (transaction.simulation.error.includes("Error(Contract, #8)")) {
      console.log("Already planted");
    } else {
      console.error("Plant Error:", transaction.simulation.error);
      state.errorCount++;
      return;
    }
  } else {
    await transaction.signAuthEntries({
      address: Bun.env.FARMER_PK,
      signAuthEntry: farmerSigner.signAuthEntry,
    });

    await send(transaction);

    console.log(" 🌱 Successfully planted!");
  }

  state.isPlanted = true;
  state.isPlanting = false;
}

/**
 * Converts block timestamp to milliseconds
 */
function blockTimestampToMs(timestamp: number | bigint): number {
  return typeof timestamp === "bigint"
    ? Number(timestamp * 1000n)
    : timestamp * 1000;
}

/**
 * Schedules the work to be done at the appropriate time
 */
function scheduleWork(
  blockTimestamp: number | bigint,
  index: number,
  entropy: string,
): void {
  const blockTimeMs = blockTimestampToMs(blockTimestamp);
  const currentTimeMs = Date.now();

  // Calculate when the work should be performed
  const targetTimeMs = blockTimeMs + WORK_DELAY_MINUTES * 60 * 1000;
  const waitTimeMs = Math.max(0, targetTimeMs - currentTimeMs);

  console.log(
    `Current block time: ${new Date(blockTimeMs).toLocaleTimeString()}`,
  );
  console.log(
    `Scheduling work in ${waitTimeMs}ms (at ${new Date(targetTimeMs).toLocaleTimeString()})`,
  );

  // Schedule the action
  setTimeout(() => {
    console.log("Executing scheduled work");
    bootProc(index, entropy);
  }, waitTimeMs);
}

/**
 * Schedules the next check for a new block
 */
function scheduleNextCheck(blockTimestamp: number | bigint): void {
  const blockTimeMs = blockTimestampToMs(blockTimestamp);
  const currentTimeMs = Date.now();

  // Calculate when to check for the next block
  const targetTimeMs = blockTimeMs + CHECK_DELAY_MINUTES * 60 * 1000;

  if (targetTimeMs < currentTimeMs) {
    setTimeout(() => {
      console.log("Waiting for a new block...");
      run();
    }, RETRY_DELAY_MS);
    return;
  }

  // Calculate how long to wait from now
  const waitTimeMs = Math.max(0, targetTimeMs - currentTimeMs);

  console.log(
    `Scheduling next check in ${waitTimeMs}ms (at ${new Date(targetTimeMs).toLocaleTimeString()})`,
  );

  // Schedule the action
  setTimeout(() => {
    console.log("Executing scheduled check");
    run();
  }, waitTimeMs);
}

run();
