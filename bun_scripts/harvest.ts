import { Api } from "@stellar/stellar-sdk/rpc";
import { contract, getContractData, send } from "./utils";

let { index } = await getContractData()

if (index) {
    await runHarvest(index)

    const env_file = Bun.env.ENV === 'mainnet' ? '.env' : '.env.testnet';

    let env = await Bun.file(env_file).text();

    const envLines = env.split('\n').filter(line => line.trim());

    env = envLines.slice(0, -1).join('\n');

    await Bun.write(env_file, `${env}\nINDEX=${index}`.trim());
}

async function runHarvest(index: number) {
    console.log('Harvesting', index);

    const at = await contract.harvest({
        farmer: Bun.env.FARMER_PK,
        index
    })

    if (!Api.isSimulationError(at.simulation!)) {
        await send(at)
        const reward = Number(at.result - BigInt(Bun.env.STAKE_AMOUNT)) / 1e7;
        console.log('Successfully harvested', index, reward);
        process.send?.(`Successfully harvested ${index} ${reward}`);
    }

    index--;

    if (index >= Bun.env.INDEX && index >= 0)
        return runHarvest(index)
}