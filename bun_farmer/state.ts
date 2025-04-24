// Initial state for the farmer
export const initialState: FarmerState = {
  contractData: { index: 0, block: undefined, pail: undefined },
  process: undefined,
  previousIndex: undefined,
  hasPlanted: false,
  hasWorked: false,
  errorCount: 0,
  shouldFetchNextBlock: true,
  farmingError: '',
  isWorking: false,
  bypassCheckTime: false,
};
