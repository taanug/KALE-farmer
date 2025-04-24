import * as blessed from "blessed";
import * as net from "net";
import * as fs from "fs";
import { log, logError } from "./utils";

export function displayTable(
  dataSources: (() => any)[],
  initialState: TableState = { currentView: 0, scrollOffset: 0, autoScroll: true },
  config: Partial<TableConfig> = {},
  launchTubeCredits: string | undefined = '',
  uptime: string
): TableController {
  const screen = blessed.screen({ smartCSR: true, title: "KalePail Rust Farmer" });
  const { maxRows = 9, viewNames = ["Farming", "Harvesting"], columnWidths = [8, 10, 15] } = config;
  let state = initialState;
  let farmingLogs: any = {};
  let harvestLogs: any = {};
  dataSources[0] = () => farmingLogs;
  dataSources[1] = () => harvestLogs;
  
  const table = blessed.table({
    parent: screen,
    top: 1,
    left: 0,
    width: "100%",
    height: maxRows + 2,
    border: "line",
    align: "left",
    keys: true,
    interactive: true,
    style: { header: { fg: "green" }, border: { fg: "gray" } },
    columnWidth: columnWidths,
  });

  const header = blessed.text({ parent: screen, top: 0, left: 0, content: "Loading Kale Rust Farmer..."});
  const launchTubeInfo = blessed.text({ parent: screen, top: 0, right: 0, content: "" });
  const statusLine = blessed.text({ parent: screen, bottom: 0, left: 0, width: "100%", content: "" });

  const getTableData = (logs: any, scrollOffset: number, maxRows: number) => {
    const logEntries = Object.keys(logs).reverse();
    const visibleLogs = logEntries.slice(scrollOffset, scrollOffset + maxRows);
    return [
      ["Block", "Status", "Block Time"],
      ...visibleLogs.map((key: any) => [key, logs[key].status || "N/A", logs[key].blockTime || "N/A"]),
    ];
  };

  const getStatusText = (state: TableState, logsLength: number) => {
    const { currentView, scrollOffset, autoScroll } = state;
    const scrollDisplay = logsLength <= maxRows ? 0 : scrollOffset;
    return `${viewNames[currentView]} (Scroll: ${scrollDisplay}${autoScroll ? ", Auto" : ""}) | Total: ${logsLength} | Press '1'/'2' to switch views, ↑/↓ to scroll, 'q' to quit          ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  };

  const clampScrollOffset = (scrollOffset: number, totalRows: number, maxRows: number) =>
    Math.max(0, Math.min(scrollOffset, totalRows > maxRows ? totalRows - maxRows : 0));

  const renderTable = (state: TableState, launchTubeCredits: string, uptime: string): TableState => {
    let farmLogMap;
    let totalRows;
    let newScrollOffset = state.scrollOffset;;
      
    try{
      farmLogMap = dataSources[state.currentView]();
      totalRows = Object.keys(farmLogMap).length;
      newScrollOffset = state.autoScroll && totalRows > maxRows ? 0 : clampScrollOffset(state.scrollOffset, totalRows, maxRows);
      header.setContent(`KalePail Rust v0.0.1 Farmer ...${Bun.env.FARMER_PK?.slice(-4) || "N/A"} ${uptime}` )
      launchTubeInfo.setContent(launchTubeCredits || "");
      table.setData(getTableData(farmLogMap, newScrollOffset, maxRows));
      statusLine.setContent(getStatusText({ ...state, scrollOffset: newScrollOffset }, totalRows));
      screen.render();
    } catch (msg){
      log("renderTable Error", msg)
    }
    return { ...state, scrollOffset: newScrollOffset };

  };

  const reduceState = (state: TableState, action: string) => {
    const farmLogMap = dataSources[state.currentView]();
    const totalRows = Object.keys(farmLogMap).length;
    switch (action) {
      case "1":
        return { ...state, currentView: 0, scrollOffset: 0, autoScroll: true };
      case "2":
        return dataSources.length > 1 ? { ...state, currentView: 1, scrollOffset: 0, autoScroll: true } : state;
      case "up":
        return state.scrollOffset > 0 ? { ...state, scrollOffset: state.scrollOffset - 1, autoScroll: false } : state;
      case "down":
        return state.scrollOffset + maxRows < totalRows ? { ...state, scrollOffset: state.scrollOffset + 1, autoScroll: false } : state; // Fixed: Added autoScroll: false
      case "quit":
        process.exit(0);
        return state;
      default:
        return state;
    }
  };

  const updateStateAndRender = (action: string) => { 
    try{
      state = reduceState(state, action); 
      state = renderTable(state, launchTubeCredits, uptime); 
    } catch (err){
      logError('------------------farmerLog error: updateStateAndRender', err)
    }
  };

  screen.key(["1"], () => updateStateAndRender("1"));
  screen.key(["2"], () => updateStateAndRender("2"));
  screen.key(["up"], () => updateStateAndRender("up"));
  screen.key(["down"], () => updateStateAndRender("down"));
  screen.key(["q", "C-c"], () => updateStateAndRender("quit"));

  if (fs.existsSync(`/tmp/kalepail-ipc-${Bun.env.FARMER_PK}.sock`)) fs.unlinkSync(`/tmp/kalepail-ipc-${Bun.env.FARMER_PK}.sock`);
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      const farmingLogsTemp = farmingLogs;
      const harvestLogsTemp = harvestLogs;
      const stateTemp = state;
      try{
        const { farmingLogs: newFarmingLogs, harvestLogs: newHarvestLogs, launchTubeCredits: newLaunchtubeCredits, uptime: newUptime } = JSON.parse(data.toString());
        farmingLogs = newFarmingLogs;
        harvestLogs = newHarvestLogs;
        state = renderTable(state, newLaunchtubeCredits, newUptime);
      } catch (err){
        farmingLogs = farmingLogsTemp;
        harvestLogs = harvestLogsTemp;
        state = stateTemp;

        // ignore for now, it will fix itself on the next update
        //logError('-------------------farmerLog error: onData', data)
      }
    });
    // Exit when the parent closes the connection
    socket.on("end", () => {
      log("Parent process disconnected, exiting...");
      process.exit(0); // Closes the child process and Terminal window
    });
    socket.on("close", (err) => {
      logError("--------------IPC Server close:", err);
      //process.exit(1)
    })
    socket.on("error", (err) => {
      logError("Socket error:-----------------------", err.message);
      process.exit(1); // Exit on error, e.g., if parent crashes unexpectedly
    });
  });
  server.listen(`/tmp/kalepail-ipc-${Bun.env.FARMER_PK}.sock`);

  state = renderTable(state, launchTubeCredits, uptime);

  return {
    update: () => { state = renderTable(state, launchTubeCredits, uptime); return state; },
    getState: () => ({ ...state }),
  };
}

if (import.meta.main) {
  displayTable(
    [() => ({}), () => ({})], // Dummy initial dataSources, updated via IPC
    undefined,
    { viewNames: ["Farming", "Harvesting"] },
    "Loading LaunchTube data...", 
    "Loading Uptime..."
  );
}