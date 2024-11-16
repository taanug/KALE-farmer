import { Api } from "@stellar/stellar-sdk/rpc";
import { contract, getContractData, readINDEX, send, writeINDEX } from "./utils";

let { index } = await getContractData(true)
let START_INDEX = index;

await runHarvest(index);
await writeINDEX(index);

async function runHarvest(index: number) {
    console.log('Harvesting', index);
    process.send?.(`Harvesting ${index}`);

    const at = await contract.harvest({
        farmer: Bun.env.FARMER_PK,
        index
    })

    if (Api.isSimulationError(at.simulation!)) {
        if (!(
            at.simulation.error.includes('Error(Contract, #9)')
            || at.simulation.error.includes('Error(Contract, #10)')
            || at.simulation.error.includes('Error(Contract, #14)')
        )) {
            console.error('Harvest Error:', at.simulation.error);
        }
    } else {
        await send(at)
        const reward = Number(at.result - BigInt(Bun.env.STAKE_AMOUNT)) / 1e7;
        console.log('Successfully harvested', index, reward);
        process.send?.(`Successfully harvested ${index} ${reward}`);
    }

    index--;

    if (index >= await readINDEX() && index >= 0 && index >= START_INDEX - 288) // 24 hours of 5 minute blocks
        return runHarvest(index)
}