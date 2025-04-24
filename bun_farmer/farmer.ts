// main.ts
import * as net from "net";
import { initialState } from './state';
import { runCycle } from './farming';
import { fetchAndLogLaunchTubeJWTInfo, getHarvestTime, getUptime, log, logError, spawn } from './utils';

const socketPath = `/tmp/kalepail-ipc-${Bun.env.FARMER_PK}.sock`;
const startTime:number = Date.now();
const checkEveryMs = Number(process.env.CHECK_EVERY_MS) || 5000;

let launchTubeCredits: string | undefined = await fetchAndLogLaunchTubeJWTInfo();
let farmingLogs: any = {};
let harvestLogs: any = {};
let harvestStartTime: number = Date.now() + Number(Bun.env.HARVEST_EVERY_MS);
let currentBlockStartTime:number | undefined = 0;

const farmingLoop = async (state: FarmerState, socket?: net.Socket) => {
  let currentState = state;
  if(currentState.shouldFetchNextBlock){
    log(getFarmingStats())
  }
  currentState = await runCycle(currentState);
  currentBlockStartTime = Number(currentState?.contractData?.block?.timestamp)
  let status = getStatus(currentState);
  const timeSinceBlock = getElapsedBlockTime();
  const blockNumber = currentState?.contractData?.index;
  // Todo add block number here
  log(`🥬 ${!blockNumber ? 'Preparing to farm...' : `Block: ${blockNumber} ${getUptime(timeSinceBlock)}`} ${status} Errors: ${currentState.errorCount}`);
  
  if (process.env.DEBUG !== 'true') {
    const blockNumber = currentState?.contractData?.index;
    if (blockNumber) {
      farmingLogs[blockNumber] = { status, blockTime: getBlockTime(status)};
    }
  }

  //{"status":400,"error":"No credits left"}

  fetchAndLogLaunchTubeJWTInfo().then(result => { launchTubeCredits = result; })
  setTimeout(() => farmingLoop(currentState, socket), checkEveryMs);
};

const startFarming = async (state: FarmerState, socket?: net.Socket) => { 
  fetchAndLogLaunchTubeJWTInfo().then(result => { launchTubeCredits = result; });
  void farmingLoop(state, socket);
  setInterval(()=>{
    updateBlockTimesInFarmLog(getElapsedBlockTime())
    removeHarvestedFromFarmingLog();
    if (socket) {
      socket.write(JSON.stringify({ farmingLogs, harvestLogs, launchTubeCredits, uptime: getFarmingStats()}))
    }
  }, 1000)
  setInterval(async () => {
    spawn(['bun', 'harvest.ts'], 
      (msg:any)=>{
        updateLogs(msg);
        log(msg) 
      })
      harvestStartTime = Date.now() + Number(Bun.env.HARVEST_EVERY_MS)
  }, Number(Bun.env.HARVEST_EVERY_MS) || 420000);
};

const getFarmingStats = ()=>{
  const totalFarmedKale:number = Object.keys(harvestLogs).reduce((acc:number, key) => {
    if (harvestLogs[key]) {
      acc += parseFloat(harvestLogs[key].status.match(/[0-9]+\.[0-9]+/)?.[0] || '0');
    }
    return acc;
  }, 0);

  const farmingStats = `Uptime: ${getUptime(startTime)} | Total: ${totalFarmedKale.toFixed(4)} KALE`;
  return farmingStats;
}

const getStatus = (state: FarmerState) => {
  const { isWorking, hasWorked, hasPlanted, farmingError } = state;
  let status = farmingError 
    ? farmingError
    : hasWorked 
      ? (typeof hasWorked === 'string' 
        ? hasWorked 
        : 'Done - This block was already farmed')
      : isWorking && !hasWorked
        ? "Kale farming in progress..."  
        : !hasPlanted && !hasWorked && !hasWorked
          ? "Planting..."
          : hasPlanted && !isWorking && !hasWorked
            ? "Planted..."
              : "Let's farm some Kale!...";
  return status;
};

const updateLogs = (msg:HarvestMessage) => {
  const { id: msgId, status } = msg;

  let entry = farmingLogs[msgId];
  
  if(!entry || !entry?.status){
    entry = {
      status,
      blockTime: '',
    }
  }

  if (entry?.status?.includes("Error")) return;

  entry.status = status;
  entry.blockTime = getBlockTime(status)
  
  if(entry?.status?.includes("Harvested")){
    harvestLogs[msgId] = entry;
  }
};

const removeHarvestedFromFarmingLog = ()=>{
  farmingLogs = Object.keys(farmingLogs).reduce((acc:Logs, key) => {
    if (!harvestLogs[key]) {
      acc[key] = farmingLogs[key];
    }
    return acc;
  }, {});
}

const getBlockTime = (status: string) => {
  return status?.includes("Failed") || status?.includes("Error") || status?.includes("Missed")
    ? "Error" 
    : status?.includes('Harvesting') || (status?.includes('Done') && getHarvestTime(harvestStartTime).includes('-'))
      ? 'Harvesting now'
      : status?.includes('Done')
        ? `Harvesting in ${getHarvestTime(harvestStartTime)}`                
          : status?.includes('Harvested') 
            ? "Farming Complete"
            : !status ? 'Planting...' : getUptime(getElapsedBlockTime()) 
}

const updateBlockTimesInFarmLog = (timeSinceBlock: number)=>{
  farmingLogs = Object.keys(farmingLogs).reduce((acc:Logs, key) => {
    farmingLogs[key].blockTime = getBlockTime(farmingLogs[key].status)
      acc[key] = farmingLogs[key];
    return acc;
  }, {});
}

const getElapsedBlockTime = ()=>(!!currentBlockStartTime ? new Date(Number(currentBlockStartTime * 1000)) : new Date(0)).getTime();
  






if (process.env.DEBUG !== 'true') {
  let command;
  if (process.platform === "linux") {
    command = ["gnome-terminal", "--", "bun", "run", "farmerLog.ts"];
  } else if (process.platform === "darwin") {
    command = [
      "osascript",
      "-e", 'tell application "Terminal"',
      "-e", 'activate',
      "-e", `do script "cd ${process.cwd()} && bun run farmerLog.ts"`,
      "-e", 'set the bounds of the front window to {0, 0, 900, 370}',
      "-e", 'end tell'
    ];
  } else if (process.platform === "win32") {
    command = ["cmd", "/c", "start", "bun", "run", "farmerLog.ts"];
  } else {
    throw new Error("Unsupported platform");
  }
  
  Bun.spawn(command, { cwd: process.cwd(), stdio: ["inherit", "inherit", "inherit"] });

  log("Launched farmerLog in a new terminal");

  setTimeout(() => {
    const socket = net.connect(socketPath, () => {
      log("Connected to farmerLog via IPC");
      startFarming(initialState, socket);
    });
    socket.on("close", (err) => {
      logError("--------------IPC close:", err);
      //process.exit(1)
    })
    socket.on("error", (err) => {
      logError("--------------IPC error:", err.message);
      //process.exit(1)
    });
    // Ensure socket closes when parent exits
    process.on("exit", () => {
      log("Process exited, ending socket connection to farmerLog");
      socket.end(); // Explicitly close the socket
    });
  }, 2000); // Wait for the new terminal to init
} else {
  startFarming(initialState);
}