import { Api } from "@stellar/stellar-sdk/rpc";
import { contract, getIndex, getPail, readINDEX, send, writeINDEX } from "./utils";

// TODO no need to harvest something A) we cannot harvest (too soon) or B) we've already harvested

let index = await getIndex() - 1; // Current index will never be able to be harvested
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
        // TODO still surprised this can happen. 
        // A stroop is a really small amount and seems like we should be able to get it way before zero if we're doing any work at all
        if (at.result === BigInt(0)) {
            // 7650
            // 7657
            console.log('No reward to harvest', index);
            process.send?.(`No reward to harvest ${index}`);
            return;
        }

        // must come before send as send deletes the pail value
        const stake = (await getPail(index))?.stake ?? BigInt(Bun.env.STAKE_AMOUNT);

        await send(at)

        const reward = Number(at.result - stake) / 1e7;

        console.log('Successfully harvested', index, reward);
        process.send?.(`Successfully harvested ${index} ${reward}`);
    }

    index--;

    if (index >= await readINDEX() && index >= 0 && index >= START_INDEX - 288) // 24 hours of 5 minute blocks
        return runHarvest(index)
}