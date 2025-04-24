import { Api } from '@stellar/stellar-sdk/minimal/rpc';
import { contract, getIndex, log, logError, readINDEX, send, writeINDEX } from './utils';

// TODO no need to harvest something A) we cannot harvest (too soon) or B) we've already harvested

const index = (await getIndex()) - 1; // Current index will never be able to be harvested
const START_INDEX = index;

await runHarvest(index);
await writeINDEX(index);

async function runHarvest(index: number) {
  log({id: index, status: `Harvesting`});
    process.send?.({id: index, status: `Harvesting`});

  const at = await contract.harvest({
    farmer: Bun.env.FARMER_PK || 'FARMER_PK Not Provided',
    index,
  });

  if (Api.isSimulationError(at.simulation!)) {
    // Don't log the error if...
    if (
      !(
        (
          at.simulation.error.includes('Error(Contract, #9)') || // PailMissing
          at.simulation.error.includes('Error(Contract, #10)') || // WorkMissing
          at.simulation.error.includes('Error(Contract, #11)') || // BlockMissing
          at.simulation.error.includes('Error(Contract, #14)')
        ) // HarvestNotReady
      )
    ) {
      logError('Harvest Error:', at.simulation.error);
    }
  } else {
    // NOTE this shouldn't be happening much, at all? anymore
    // A stroop is a really small amount and seems like we should be able to get it way before zero if we're doing any work at all
    if (at.result === BigInt(0)) {
      log('No reward to harvest', index);
      process.send?.(`No reward to harvest ${index}`);
      return;
    }
    try {
      await send(at);
    } catch (err) {
      logError('Harvest Error:', err);
    }

    const reward = Number(at.result) / 1e7;

    log({id: index, status: `Harvested ${reward} KALE`});
    process.send?.({id: index, status: `Harvested ${reward} KALE`});
  }

  index--;

  // 24 hours of 5 minute blocks
  if (
    index >= 0 && // nothing negative
    index >= (await readINDEX()) - 6 && // always 30 minutes
    index >= START_INDEX - 288 // default 24 hours
  ) {
    await Bun.sleep(500);
    return runHarvest(index);
  }
}
