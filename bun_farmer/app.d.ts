// Augment the 'bun' module to add custom Env interface
declare module 'bun' {
  interface Env {
    ENV: string;
    RPC_URL: string;
    NETWORK_PASSPHRASE: string;
    LAUNCHTUBE_URL: string;
    LAUNCHTUBE_JWT: string;
    FARMER_PK: string;
    FARMER_SK: string;
    CONTRACT_ID: string;
    STAKE_AMOUNT: number;
    NONCE_COUNT: number;
    INDEX: number;
    WORK_DELAY_MS: number;
    MAX_ERROR_LIMIT: string; // Maximum allowed errors before shutdown
    CHECK_EVERY_MS: string; // Interval to check for new blocks (ms)
    HARVEST_EVERY_MS: string; // Delay before harvesting (ms)
    DEBUG: string;
    PLANT_DELAY_MS: string;
  }
}

// Data from the contract
interface ContractData {
  index: number; // Current block index
  block: Block | undefined; // Block details
  pail: Pail | undefined; // Pail details
}

interface Block {
  timestamp?: bigint;
  min_gap: bigint;
  min_stake: bigint;
  min_zeros: bigint;
  max_gap: bigint;
  max_stake: bigint;
  max_zeros: bigint;
  entropy?: Buffer;
  staked_total?: bigint;
  normalized_total?: bigint;
}

interface Pail {
  sequence: bigint;
  gap: bigint | undefined;
  stake: bigint;
  zeros: bigint | undefined;
}

// Type for the farming process
type FarmerProcess = Subprocess<'ignore', 'pipe', 'inherit'>;

interface LogEntry {
  status: string;
  blockTime: string;
}

interface Logs {
  [key: string]: LogEntry;
}

interface HarvestMessage {
  id: string;
  status: string;
}

interface TableState { currentView: number; scrollOffset: number; autoScroll: boolean; }
interface TableConfig { maxRows: number; viewNames: string[]; columnWidths: number[]; }
interface TableController { update: () => TableState; getState: () => TableState; }


// All state needed to run the farmer
interface FarmerState {
  contractData: ContractData; // Current contract info
  process: FarmerProcess | undefined; // Running farming process
  previousIndex: number | undefined; // Last processed block index
  hasPlanted: boolean; // Has planting occurred?
  hasWorked: string | boolean; // Has work been completed?
  errorCount: number; // Number of errors encountered
  shouldFetchNextBlock: boolean; // Is this the initial run?
  farmingError: string;
  isWorking: boolean;
  bypassCheckTime: boolean;
}

// Function signatures
type StartFarmingFn = (initialState: FarmerState) => void;

type RunCycleFn = (state: FarmerState) => Promise<FarmerState>;

type StartWorkFn = (
  state: FarmerState,
  index: number,
  entropy: string,
) => Promise<FarmerState>;

type PlantFn = (state: FarmerState) => Promise<FarmerState>;

type HandleErrorFn = (
  state: FarmerState,
  error: string,
  prefix: string
) => FarmerState;

type CalculateTimeFn = (block: Block | undefined, comparedtime: number) => boolean;