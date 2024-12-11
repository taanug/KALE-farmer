use clap::Parser;
use core::sync::atomic::AtomicBool;
use rayon::prelude::*;
use sha3::{Digest, Keccak256};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Block index
    #[arg(short, long)]
    index: u32,

    /// Previous block hash (hex string)
    #[arg(short, long)]
    entropy_hex: String,

    /// Farmer address (as hex string)
    #[arg(short, long)]
    farmer_hex: String,

    /// Number of leading zeros required
    #[arg(short, long)]
    min_zeros: u32,
}

struct HashMiner {
    thread_count: usize,
    chunk_size: u64,
    found: Arc<AtomicBool>,
    hash_array: [u8; 76],
    min_zeros_binary: u32,
}

#[derive(Debug)]
struct Return {
    local_hash: [u8; 32],
    start_nonce: u64,
    local_nonce: u64,
}

impl HashMiner {
    fn new(
        thread_count: usize,
        index: u32,
        entropy: [u8; 32],
        farmer: [u8; 32],
        min_zeros: u32,
    ) -> Self {
        let mut hash_array = [0; 76];

        hash_array[..4].copy_from_slice(&index.to_be_bytes());
        hash_array[12..44].copy_from_slice(&entropy);
        hash_array[44..].copy_from_slice(&farmer);

        Self {
            thread_count,
            chunk_size: u64::MAX / (thread_count as u64),
            found: Arc::new(AtomicBool::new(false)),
            hash_array,
            min_zeros_binary: min_zeros * 4,
        }
    }

    fn check_difficulty(&self, hash: &[u8]) -> bool {
        unsafe { *(hash[0..16].as_ptr() as *const u128) }
            .swap_bytes()
            .leading_zeros()
            >= self.min_zeros_binary
    }

    fn mine_thread(&self, thread_id: usize) -> Option<Return> {
        let start_nonce = thread_id as u64 * self.chunk_size;
        let end_nonce = if thread_id == self.thread_count - 1 {
            u64::MAX
        } else {
            start_nonce + self.chunk_size
        };

        let mut hasher = Keccak256::new();
        let mut local_hash_array = self.hash_array.clone();

        for local_nonce in start_nonce..end_nonce {
            if self.found.load(Ordering::Relaxed) {
                return None;
            }

            unsafe {
                *(local_hash_array[4..12].as_mut_ptr() as *mut u64) = local_nonce.swap_bytes();
            }

            hasher.update(local_hash_array);
            let local_hash = hasher.finalize_reset();

            if self.check_difficulty(&local_hash) {
                self.found.store(true, Ordering::Relaxed);

                return Some(Return {
                    local_hash: local_hash.into(),
                    start_nonce,
                    local_nonce,
                });
            }
        }

        None
    }

    fn mine_parallel(&self) -> Option<Return> {
        (0..self.thread_count)
            .into_par_iter()
            .map(move |thread_id| self.mine_thread(thread_id))
            .find_any(move |result| result.is_some())
            .flatten()
    }
}

fn main() {
    let thread_count = rayon::current_num_threads() - 2;
    let args = Args::parse();

    let index = args.index;
    let entropy: [u8; 32] = hex::decode(args.entropy_hex).unwrap().try_into().unwrap();
    let farmer: [u8; 32] = hex::decode(args.farmer_hex).unwrap().try_into().unwrap();
    let min_zeros = args.min_zeros;

    let start = Instant::now();
    let res = HashMiner::new(thread_count, index, entropy, farmer, min_zeros)
        .mine_parallel()
        .unwrap();

    let hash_rate = ((res.local_nonce - res.start_nonce) as f64 * thread_count as f64
        / start.elapsed().as_secs_f64())
        / 1e6;

    println!("Hashrate: {:.2} MH/s", hash_rate);
    println!(
        "[\"{}\", \"{}\"]",
        res.local_nonce,
        hex::encode(res.local_hash)
    );
}
