import { contract, getContractData, send, spawn, log, logError, exit, farmerSigner, isBlockTimeGreater, sleep } from './utils';
import { Keypair } from '@stellar/stellar-sdk/minimal';
import { Api } from '@stellar/stellar-sdk/minimal/rpc';

export const runCycle: RunCycleFn = async (state: FarmerState): Promise<FarmerState> => {
  const maxErrorLimit = Number(Bun.env.MAX_ERROR_LIMIT) || 12;
  if (state.errorCount > maxErrorLimit) {
    log('Too many errors, shutting down');
    exit(1);
    return state;
  }

  const shouldFetch = state.shouldFetchNextBlock || isBlockTimeGreater(state?.contractData.block, 300000); //5min
  const contractData = shouldFetch ? await getContractData() : state.contractData;
  const { index, block, pail } = contractData;
  const entropy = block?.entropy?.toString('hex') ?? Buffer.alloc(32).toString('hex');
  let updatedState = { ...state, contractData };

  if (index !== state.previousIndex) {
      if(!state.hasWorked && !state.shouldFetchNextBlock){
        log('Missed block', index)
        state.process?.kill();
        updatedState = {...updatedState, contractData: state?.contractData, shouldFetchNextBlock: true, process: undefined, isWorking: false, hasWorked: false, previousIndex: undefined}
        return handleError(updatedState, "New block found, work not completed", 'Missed Block');
      }
    log(state.shouldFetchNextBlock ? `Starting KALE farming with ${Bun.env.FARMER_PK}` : 'Found a new block.');
    
    log('Block Info:', index,
      {
        maxGap: block?.max_gap,
        maxZeros: block?.max_zeros,
        minGap: block?.min_gap,
        minStake: block?.min_stake,
        minZeros: block?.min_zeros,
      },
      entropy,
      new Date(Number(updatedState.contractData.block?.timestamp)));
      
    state.process?.kill();

    const newState: FarmerState = {
      ...updatedState,
      process: undefined,
      previousIndex: index,
      hasPlanted: !!(pail?.sequence || pail?.stake),
      hasWorked: !!(pail?.gap || pail?.zeros),
      shouldFetchNextBlock: true,
      farmingError: '',
      isWorking: false,
    };
    return newState;
  }
  updatedState = {...updatedState, shouldFetchNextBlock: false}
  if(!state.hasPlanted){
    log(`Waiting ${Bun.env.PLANT_DELAY_MS}ms to plant...`)
    await sleep(Number(Bun.env.PLANT_DELAY_MS) || 0);
    log('Planting...')
    updatedState = await plant(updatedState);
  }

  if (updatedState.hasPlanted && !state.hasWorked) {
    return startWork(updatedState, index, entropy);
  }
  return updatedState;
};

const startWork: StartWorkFn = async (
  state: FarmerState,
  index: number,
  entropy: string,
): Promise<FarmerState> => {
  const workWaitTime = Number(Bun.env.WORK_DELAY_MS) || 240000;
  if (!isBlockTimeGreater(state.contractData.block, workWaitTime) ) {
    return state;
  }

  let farmerProcess;
  if(!state.process){
    if(!state.isWorking){
      const updatedState = {...state, isWorking: true, farmingError: ''}
      return {...updatedState}
    }
    log('Starting work...')
    farmerProcess = spawn(
      [
        '../target/release/kale-farmer',
        '--farmer-hex',
        Keypair.fromPublicKey(Bun.env.FARMER_PK || '').rawPublicKey().toString('hex'),
        '--index',
        String(index),
        '--entropy-hex',
        entropy,
        '--nonce-count',
        String(Bun.env.NONCE_COUNT),
      ],
      ()=>{}
    );
    log('Working...')
  }

  let currentState = { ...state, process: farmerProcess ? farmerProcess : state.process};
  if (currentState.process.stdout) {
    const output = await Bun.readableStreamToText(currentState.process.stdout);
    if (output) {
      //await Bun.write(Bun.stdout, output);
      const hashrate = output.substring(0, output.indexOf('\n')).trim();
      log(output || "Waiting for work result")
      const lastLine = output.trim().split('\n').pop();
      if (lastLine) {
        try {
          const [nonce, hash] = JSON.parse(lastLine);
          const zeroCount = hash.match(/^0*/)?.[0].length ?? 0;
          const workResult = await contract.work({ farmer: Bun.env.FARMER_PK || '', hash: Buffer.from(hash, 'hex'), nonce: BigInt(nonce) });

          if (Api.isSimulationError(workResult.simulation)) {
            return handleError(currentState, workResult.simulation.error, 'Simulation Error');
          }
          let sendResult;
          try{
            log('Sending Work...')
            sendResult = await send(workResult);
          } catch (msg){
            return handleError(currentState, JSON.stringify(msg), 'Work Error');
          }
          const workLog = `Done - Gaps: ${workResult.result} Zeros: ${zeroCount} ${hashrate}`;
          log(workLog);
          // todo: add work result stats to new property workPerformance
          return { ...currentState, hasWorked: workLog, process: undefined, shouldFetchNextBlock: false, hasPlanted: true, farmingError: '' };
        } catch (err:any) {
            return handleError(currentState, err, 'Stream Error')
        }
      }
    }
  }
  return currentState;
};

const plant: PlantFn = async (state: FarmerState): Promise<FarmerState> => {
  let plantResult;
  try{
    plantResult = await contract.plant({
      farmer: Bun.env.FARMER_PK || '',
      amount: state.errorCount ? 0n : BigInt(Bun.env.STAKE_AMOUNT || 0),
    });
  } catch (err:any){
    return handleError(state, err?.error || err?.status || err, 'Planting Failed');
  }

  if (Api.isSimulationError(plantResult.simulation)) {
    return handleError(state, plantResult.simulation.error, 'Planting Failed');
  }

  try {
    await plantResult.signAuthEntries({ address: Bun.env.FARMER_PK, signAuthEntry: farmerSigner.signAuthEntry });
    await send(plantResult);
    log(`Planted successfully with ${Number(Bun.env.STAKE_AMOUNT || 0) / 1e7} KALE staked`);
    return { ...state, hasPlanted: true, farmingError: '' };
  } catch (err:any){
    return handleError(state, err?.error || err?.status || err, 'Planting Failed');
  }
};

const handleError: HandleErrorFn = (state: FarmerState, error: string, prefix: string): FarmerState => {
  let workError = `${prefix}`;
  const worked  = 'Error(Contract, #7)'
  const planted = 'Error(Contract, #8)'
  let updatedState = {...state};
  logError(`${prefix}:`, error);
  if(!error?.includes){
    error = JSON.stringify(error);
  } 
  if (error?.includes(planted) || error?.includes(worked)) {
    const errorMessage = error?.includes(planted) ? 'Already planted' : 'Work already completed';
    workError = `${prefix}: ${errorMessage}`;
    updatedState =  { ...state, hasPlanted: error?.includes(planted), farmingError: workError, hasWorked: error?.includes(worked), shouldFetchNextBlock: true, isWorking: false};
  } else if (prefix === "Stream Error" || prefix === "Simulation Error" || prefix === 'Missed Block' || prefix === 'Work Error'){
    updatedState = { ...state, farmingError: prefix, shouldFetchNextBlock: true, hasPlanted: true, hasWorked: true, isWorking: true};
  }else {
    logError(`UNKNOWN ---------------- ${prefix}:`, error);
    updatedState = { ...state, errorCount: state.errorCount + 1, farmingError: workError, hasPlanted: false, hasWorked: false, shouldFetchNextBlock: true, previousIndex: undefined, isWorking: false};
  }
 
  return updatedState;
}

