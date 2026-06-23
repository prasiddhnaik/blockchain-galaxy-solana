import { Connection } from '@solana/web3.js'
import { useEffect, useMemo, useState } from 'react'
import snapshot from './chain-snapshot.json'

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'
const LIVE_TIMEOUT_MS = 3_800
const MIN_PLANET_RADIUS = 0.28
const MAX_PLANET_RADIUS = 0.62

export type DataSource = 'cached' | 'live'
export type ActivityCategory = 'defi' | 'token' | 'nft' | 'other'

export type ProgramCounts = Record<
  ActivityCategory | 'infra' | 'vote',
  number
>

export type CategoryMix = Record<ActivityCategory, number>

export type ChainBlock = {
  blockTime: number | null
  categoryMix: CategoryMix
  dominantCategory: ActivityCategory
  dominantProgram?: string
  failedTxRatio: number
  programCounts: ProgramCounts
  recency: number
  size: number
  slot: number
  timestamp: string
  transactions: number
}

type SnapshotBlock = {
  blockTime: number | null
  categoryMix?: CategoryMix
  dominantCategory?: ActivityCategory
  dominantProgram?: string
  failedTxRatio?: number
  programCounts?: ProgramCounts
  slot: number
  transactions: number
}

type SnapshotFile = {
  blocks: SnapshotBlock[]
}

export type ChainDataState = {
  blocks: ChainBlock[]
  source: DataSource
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('Solana RPC timed out.')),
      timeoutMs,
    )

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function formatBlockTime(blockTime: number | null) {
  if (!blockTime) {
    return '--:--:--'
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(blockTime * 1000))
}

function getDefaultProgramCounts(): ProgramCounts {
  return {
    defi: 0,
    infra: 0,
    nft: 0,
    other: 0,
    token: 0,
    vote: 0,
  }
}

function getDefaultCategoryMix(): CategoryMix {
  return {
    defi: 0,
    nft: 0,
    other: 0,
    token: 0,
  }
}

export function normalizeBlocks(
  blocks: SnapshotBlock[],
  targetCount: number,
): ChainBlock[] {
  const orderedBlocks = blocks
    .filter((block) => Number.isFinite(block.slot))
    .sort((a, b) => a.slot - b.slot)
    .slice(-targetCount)

  const transactionCounts = orderedBlocks.map((block) => block.transactions)
  const minTransactions = Math.min(...transactionCounts)
  const maxTransactions = Math.max(...transactionCounts)
  const transactionRange = Math.max(1, maxTransactions - minTransactions)
  const count = Math.max(1, orderedBlocks.length - 1)

  return orderedBlocks.map((block, index) => {
    const recency = count === 0 ? 1 : index / count
    const transactionWeight =
      (block.transactions - minTransactions) / transactionRange
    const rawSize =
      MIN_PLANET_RADIUS + transactionWeight * (MAX_PLANET_RADIUS - MIN_PLANET_RADIUS)
    const size = Math.min(MAX_PLANET_RADIUS, rawSize)

    return {
      blockTime: block.blockTime ?? null,
      categoryMix: block.categoryMix ?? getDefaultCategoryMix(),
      dominantCategory: block.dominantCategory ?? 'other',
      dominantProgram: block.dominantProgram,
      failedTxRatio: block.failedTxRatio ?? 0,
      programCounts: block.programCounts ?? getDefaultProgramCounts(),
      recency,
      size: Number(size.toFixed(3)),
      slot: block.slot,
      timestamp: formatBlockTime(block.blockTime ?? null),
      transactions: block.transactions,
    }
  })
}

async function fetchRecentSolanaBlocks(targetCount: number) {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
  const latestSlot = await connection.getSlot('confirmed')
  const slots = await connection.getBlocks(
    Math.max(0, latestSlot - targetCount * 5),
    latestSlot,
    'confirmed',
  )
  const recentSlots = slots.slice(-targetCount)
  const blocks = await Promise.all(
    recentSlots.map(async (slot) => {
      const block = await connection.getBlock(slot, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
        transactionDetails: 'full',
      })

      if (!block) {
        return null
      }

      return {
        blockTime: block.blockTime,
        slot,
        transactions: block.transactions.length,
      }
    }),
  )

  return blocks.filter((block): block is SnapshotBlock => block !== null)
}

function getCachedBlocks(targetCount: number) {
  return normalizeBlocks((snapshot as SnapshotFile).blocks, targetCount)
}

export function useSolanaBlocks(targetCount: number): ChainDataState {
  const cachedBlocks = useMemo(() => getCachedBlocks(targetCount), [targetCount])
  const [data, setData] = useState<ChainDataState>({
    blocks: cachedBlocks,
    source: 'cached',
  })

  useEffect(() => {
    let cancelled = false

    withTimeout(fetchRecentSolanaBlocks(targetCount), LIVE_TIMEOUT_MS)
      .then((blocks) => {
        if (!cancelled && blocks.length > 0) {
          setData({
            blocks: normalizeBlocks(blocks, targetCount),
            source: 'live',
          })
        }
      })
      .catch(() => {
        // Cached data is already rendered before the live request resolves.
      })

    return () => {
      cancelled = true
    }
  }, [cachedBlocks, targetCount])

  return data
}
