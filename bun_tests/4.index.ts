import { getBlock, getIndex, type Block, } from "../bun_scripts/utils";

const block_reward = BigInt(501_0000000 * 5);
const index = await getIndex()

// console.log(index);

const block = await getBlock(index - 1) as Block;

console.log(block);

const [ gap, stake, zeros ] = generate_normalizations(
    block, 

    block.max_gap,
    // 40,

    10000_0000000n,
    // 100000_0000000n,
    // 1000_0000000n,

    block.max_zeros,
    // 6
);

const reward = (gap + stake + zeros) * (block_reward + block.staked_total!) / BigInt(Math.max(Number(block.normalized_total), 1));

console.log(Number(reward) / 1e7);

const normalized_total_v2 = new Array(200).fill(0).map(() => {
    const [ gap, stake, zeros ] = generate_normalizations(
        block,
        randomNumberBetween(block.min_gap, 40), // block.max_gap),
        randomBigIntBetween(block.min_stake, 1000_0000000n), // block.max_stake),
        randomNumberBetween(block.min_zeros, 8), // block.max_zeros),
        true
    );
    return gap + stake + zeros;
}).reduce((a, b) => a + b, 0n);

const new_block: Block = {
    ...block,
    normalized_total: normalized_total_v2,
}

// console.log(new_block);

const [ new_gap, new_stake, new_zeros ] = generate_normalizations(
    new_block, 

    block.max_gap,
    // 40,

    block.max_stake,
    // 100000_0000000n,
    // 10000_0000000n,
    // 1000_0000000n,
    // 0n,

    block.max_zeros,
    // 6,

    true
);

// console.log(new_gap, new_stake, new_zeros);

const new_reward = (new_gap + new_stake + new_zeros) * (block_reward + new_block.staked_total!) / BigInt(Math.max(Number(new_block.normalized_total), 1));

console.log(Number(new_reward) / 1e7);

/**
 * Normalizes farming parameters based on block constraints
 * @param block The current block data
 * @param gap User's gap value
 * @param stake User's stake value
 * @param zeros User's zeros value
 * @returns Tuple of normalized values [normalizedGap, normalizedStake, normalizedZeros]
 */
function generate_normalizations(
    block: Block,
    gap: number,
    stake: bigint,
    zeros: number,
    v2: boolean = false,
): [bigint, bigint, bigint] {
    // Prevent division by zero by ensuring max >= min for each range
    if (
        block.max_gap < block.min_gap ||
        block.max_stake < block.min_stake ||
        block.max_zeros < block.min_zeros
    ) {
        throw new Error("BlockInvalid");
    }

    // Calculate ranges
    const range_gap = BigInt(Math.max(Number(block.max_gap - block.min_gap), 1));
    const range_stake = BigInt(Math.max(Number(block.max_stake - block.min_stake), 1));
    const range_zeros = BigInt(Math.max(Number(block.max_zeros - block.min_zeros), 1));

    // Find largest range for scaling
    const normalization_scale = BigInt(
        Math.max(Number(range_gap), Math.max(Number(range_stake), Number(range_zeros)))
    );

    // Clamp each value within its range
    const clamped_gap = BigInt(
        Math.max(Math.min(gap, Number(block.max_gap)), Number(block.min_gap))
    );
    const clamped_stake = stake > block.max_stake
        ? block.max_stake
        : stake < block.min_stake ? block.min_stake : stake;
    const clamped_zeros = BigInt(
        Math.max(Math.min(zeros, Number(block.max_zeros)), Number(block.min_zeros))
    );

    // Normalize each value, ensuring minimum of 1
    const normalized_gap = BigInt(Math.max(
        Number((clamped_gap - BigInt(block.min_gap)) * normalization_scale / range_gap),
        1
    ));

    const normalized_stake = BigInt(Math.max(
        Number((clamped_stake - block.min_stake) * normalization_scale / range_stake),
        1
    )) * (v2 ? 3n : 1n);

    const normalized_zeros = BigInt(Math.max(
        Number((clamped_zeros - BigInt(block.min_zeros)) * normalization_scale / range_zeros),
        1
    )) * (v2 ? 2n : 1n);

    return [normalized_gap, normalized_stake, normalized_zeros];
}

/**
 * Generates a random number between min and max (inclusive)
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Random number between min and max
 */
function randomNumberBetween(min: number, max: number): number {
    if (min > max) {
        throw new Error("Min must be less than or equal to max");
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random BigInt between min and max (inclusive)
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Random BigInt between min and max
 */
function randomBigIntBetween(min: bigint, max: bigint): bigint {
    if (min > max) {
        throw new Error("Min must be less than or equal to max");
    }
    
    const range = max - min + 1n;
    const bits = range.toString(2).length; // Get number of bits needed
    
    // Generate random bigint with enough bits
    let result: bigint;
    do {
        let randomBytes = new Uint8Array(Math.ceil(bits / 8));
        crypto.getRandomValues(randomBytes);
        
        // Convert to bigint
        result = BigInt('0x' + Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''));
        
        // Ensure it's within range using modulo
        result = (result % range) + min;
    } while (result > max); // Just to be extra safe
    
    return result;
}