import { Api } from "@stellar/stellar-sdk/rpc";
import { contract, getContractData, send } from "./utils";

const env_file = Bun.env.ENV === 'mainnet' ? '.env' : '.env.testnet';

let { index } = await getContractData(true)

await runHarvest(index)

let env = await Bun.file(env_file).text().then((text) =>
    text.split('\n').filter(line => line.trim()).slice(0, -1).join('\n')
);

await Bun.write(env_file, `${env}\nINDEX=${index}`.trim());

Bun.env.INDEX = index;

async function runHarvest(index: number) {
    console.log('Harvesting', index);
    process.send?.(`Harvesting ${index}`);

    const at = await contract.harvest({
        farmer: Bun.env.FARMER_PK,
        index
    })

    if (Api.isSimulationError(at.simulation!)) {
        if (!(
            at.simulation.error.includes('Error(Contract, #13)')
            || at.simulation.error.includes('Error(Contract, #9)')
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

    if (index >= Bun.env.INDEX && index >= 0)
        return runHarvest(index)
}