import { contract, getContractData, send } from "./utils";
import { SorobanRpc } from "@stellar/stellar-sdk";

const INDEX = Number(Bun.env.INDEX) || 0;

let { index } = await getContractData()

if (index) {
    await runHarvest(index)

    let env = await Bun.file('.env').text();

    const envLines = env.split('\n').filter(line => line.trim());
    
    env = envLines.slice(0, -1).join('\n');

    await Bun.write('.env', `${env}\nINDEX=${index}`.trim());
}

async function runHarvest(index: number) {
    console.log('Harvesting', index);

    const at = await contract.harvest({
        farmer: Bun.env.FARMER_PK!,
        index
    })

    if (!SorobanRpc.Api.isSimulationError(at.simulation!)) {
        await send(at)
        console.log('Successfully harvested', index);
    }

    index--;

    if (index >= INDEX && index >= 0)
        return runHarvest(index)
}