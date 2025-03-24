import type { Subprocess } from "bun";
import { contract, farmerSigner, getContractData, send } from "./utils";
import { Keypair } from "@stellar/stellar-sdk/minimal";
import { Api } from "@stellar/stellar-sdk/minimal/rpc";
import { harvestSingleBlock } from "./harvest";
import chalk from "chalk";
import { visual, log, formatDuration } from "./console-utils";

// Constants for magic numbers
const WORK_DELAY_MINUTES = 4.7; //adjust this value to let kales ripen for more/less time
const CHECK_DELAY_MINUTES = 5.2;
const MAX_ERRORS = 12;
const RETRY_DELAY_MS = 10000;

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
  if (state.previousBlockIndex === 0) {
    showStartupBanner();
  }

  if (state.errorCount > MAX_ERRORS) {
    log.error(`Too many errors (${state.errorCount}/${MAX_ERRORS}), exiting`);
    process.exit(1);
  }

  try {
    const { index, block, pail } = await getContractData();
    const entropy = block?.entropy
      ? block.entropy.toString("hex")
      : Buffer.alloc(32).toString("hex");

    // If there's a new block
    if (index !== state.previousBlockIndex) {
      log.block(`Found a new block at ${index}`);
      visual.separator();

      if (state.workerProcess) {
        log.info("Terminating previous worker process");
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
      new Date().getTime() - blockTimestampToMs(block.timestamp) >=
        4 * 60 * 1000
    ) {
      log.info("Not enough time to plant on this block.");
      scheduleNextCheck(block.timestamp);
      return;
    }

    if (!state.isPlanted && !state.isPlanting) await plant();

    if (block?.timestamp) {
      if (!state.hasWorked && !state.isWorking)
        scheduleWork(block.timestamp, index, entropy);

      scheduleNextCheck(block.timestamp);
    }
  } catch (error) {
    log.error(`Something unexpected happened: restarting process`);
    state.errorCount++;
    state.previousBlockIndex = 0;
    state.isWorking = false;
    state.isPlanting = false;
    state.isPlanted = false;
    state.hasWorked = false;
    if (state.workerProcess) {
      log.info("Terminating previous worker process");
      state.workerProcess.kill();
      state.workerProcess = undefined;
    }
    setTimeout(run, RETRY_DELAY_MS);
  }
}

/**
 * Starts the worker process to perform farming work
 */
async function bootProc(index: number, entropy: string): Promise<void> {
  state.isWorking = true;

  log.work("Working...");

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
        log.work("Already worked");
      } else {
        log.error(`Work Error: ${transaction.simulation.error}`);
        state.errorCount++;
        return;
      }
    } else {
      await send(transaction);
      log.work(
        `Nice work! Kales has been ripening for ${transaction.result} days, and you've found ${countZeros} magic seeds`,
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
  log.plant("Planting seeds...");

  // TODO: dynamic stake amount
  const transaction = await contract.plant({
    farmer: Bun.env.FARMER_PK,
    amount: 0n,
  });

  if (Api.isSimulationError(transaction.simulation!)) {
    if (transaction.simulation.error.includes("Error(Contract, #8)")) {
      log.plant("Already planted");
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

    log.plant("Successfully planted!");
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

  log.info(`Current block time: ${new Date(blockTimeMs).toLocaleTimeString()}`);
  log.schedule(
    `Next work in ${formatDuration(waitTimeMs)} (at ${new Date(targetTimeMs).toLocaleTimeString()})`,
  );

  // Schedule the action
  setTimeout(() => {
    log.work("Starting working process");
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
      log.info("Waiting for a new block...");
      run();
    }, RETRY_DELAY_MS);
    return;
  }

  // Calculate how long to wait from now
  const waitTimeMs = Math.max(0, targetTimeMs - currentTimeMs);

  log.schedule(
    `Next check in ${formatDuration(waitTimeMs)} (at ${new Date(targetTimeMs).toLocaleTimeString()})`,
  );
  visual.separator();

  // Schedule the action
  setTimeout(() => {
    log.schedule("Executing scheduled check");
    run();
  }, waitTimeMs);
}

function showStartupBanner(): void {
  console.clear();
  console.log(
    chalk.green(`
    🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬
    🥬                               🥬
    🥬     Starting Kale Farmer      🥬
    🥬     Work Delay: ${WORK_DELAY_MINUTES}min        🥬
    🥬     Check Delay: ${RETRY_DELAY_MS}ms      🥬
    🥬     Farmer: ${Bun.env.FARMER_PK.substring(0, 8)}...       🥬
    🥬                               🥬
    🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬 🥬
  `),
  );
  visual.separator();
}

run();
