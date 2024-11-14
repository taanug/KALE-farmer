declare module "bun" {
    interface Env {
        ENV: string
        RPC_URL: string
        NETWORK_PASSPHRASE: string
        LAUNCHTUBE_URL: string
        LAUNCHTUBE_JWT: string
        FARMER_PK: string
        FARMER_SK: string
        CONTRACT_ID: string
        STAKE_AMOUNT: number
        ZERO_COUNT: number
        INDEX: number
    }
}