import type { Subprocess } from 'bun';
import type { Block, Pail } from './utils';

// Contract data interface
export interface ContractData {
  index: number;
  block: Block | undefined;
  pail: Pail | undefined;
}

// Process type alias for better readability
export type FarmerProcess = Subprocess<'ignore', 'pipe', 'inherit'>;

// Function type signatures
export type MainFn = () => void;
export type RunFn = () => Promise<void>;
export type HandleNewBlockFn = (
  index: number,
  block: Block | undefined,
  entropy: string,
  pail: Pail | undefined
) => void;
export type LogStatusFn = (index: number) => void;
export type BootProcFn = (
  index: number,
  entropy: string,
  timeDiff: number
) => Promise<void>;
export type ReadStreamFn = (
  reader: ReadableStream<Uint8Array>
) => Promise<void>;
export type HandleWorkSimulationErrorFn = (error: string) => void;
export type PlantFn = () => Promise<void>;
export type HandlePlantSimulationErrorFn = (error: string) => void;
export type SetTimeDiffFn = (block: Block | undefined) => void;
