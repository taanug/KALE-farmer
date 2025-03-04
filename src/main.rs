use clap::Parser;
use core::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use rayon::prelude::*;
use sha3::{Digest, Keccak256};
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
    nonce_count: u64,
}

struct HashMiner {
    max_nonce: Arc<AtomicU64>,
    max_zeros: Arc<AtomicU32>,
    chunk_size: u64,
    thread_count: usize,
    hash_array: [u8; 76],
}

pub struct Nonce {
    max_nonce: u64,
    local_hash: Vec<u8>,
}

impl Nonce {    
    pub fn new(max_nonce: u64, local_hash: Vec<u8>) -> Nonce {
        Nonce { max_nonce, local_hash }
    }
    pub fn max_nonce(&self) -> u64 {
        self.max_nonce
    }
    pub fn local_hash(&self) -> Vec<u8> {
        self.local_hash.clone() // Return a clone to ensure safe transfer
    }
}

impl HashMiner {
    fn new(
        thread_count: usize,
        nonce_count: u64,
        index: u32,
        entropy: [u8; 32],
        farmer: [u8; 32],
    ) -> Self {
        let mut hash_array = [0; 76];

        hash_array[..4].copy_from_slice(&index.to_be_bytes());
        hash_array[12..44].copy_from_slice(&entropy);
        hash_array[44..].copy_from_slice(&farmer);

        Self {
            max_nonce: Arc::new(AtomicU64::new(0)),
            max_zeros: Arc::new(AtomicU32::new(0)),
            chunk_size: nonce_count / (thread_count as u64),
            thread_count,
            hash_array,
        }
    }

    fn check_zeros(&self, hash: &[u8]) -> bool {
        let mut zeros = 0;

        for byte in hash {
            if *byte == 0 {
                zeros += 8;
            } else {
                zeros += byte.leading_zeros();
                break;
            }    
        }

        if zeros > self.max_zeros.load(Ordering::Relaxed) {
            self.max_zeros.store(zeros, Ordering::Relaxed);
            return true
        }

        false
    }

    fn mine_thread(&self, thread_id: usize) {
        let start_nonce = thread_id as u64 * self.chunk_size;
        let end_nonce = start_nonce.saturating_add(self.chunk_size);

        let mut hasher = Keccak256::new();
        let mut local_hash_array = self.hash_array.clone();

        for local_nonce in start_nonce..end_nonce {
            local_hash_array[4..12].copy_from_slice(&local_nonce.to_be_bytes());

            hasher.update(local_hash_array);

            if self.check_zeros(&hasher.finalize_reset()) {
                self.max_nonce.store(local_nonce, Ordering::Relaxed);
            }
        }
    }

    fn mine_parallel(&self) -> Nonce {
        (0..self.thread_count)
            .into_par_iter()
            .for_each(move |thread_id| self.mine_thread(thread_id));

        let mut hasher = Keccak256::new();
        let mut local_hash_array = self.hash_array.clone();
        let max_nonce = self.max_nonce.load(Ordering::Relaxed);

        local_hash_array[4..12].copy_from_slice(&max_nonce.to_be_bytes());

        hasher.update(local_hash_array);
        let local_hash: &[u8] = &hasher.finalize();

        return Nonce { max_nonce, local_hash: local_hash.to_vec() };
    }
}

pub fn main() {
    let thread_count = rayon::current_num_threads() - 2;
    let args = Args::parse();

    let index = args.index;
    let entropy: [u8; 32] = hex::decode(args.entropy_hex).unwrap().try_into().unwrap();
    let farmer: [u8; 32] = hex::decode(args.farmer_hex).unwrap().try_into().unwrap();
    let nonce_count = args.nonce_count;

    let start = Instant::now();
    let res = HashMiner::new(thread_count, nonce_count, index, entropy, farmer)
        .mine_parallel();

    let hash_rate = (nonce_count as f64
        / start.elapsed().as_secs_f64())
        / 1e6;

    println!("Hashrate: {:.2} MH/s", hash_rate);
    println!(
        "[\"{}\", \"{}\"]",
        res.max_nonce,
        hex::encode(res.local_hash)
    );
}
