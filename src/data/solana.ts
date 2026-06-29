import { Connection } from '@solana/web3.js'
import { useEffect, useMemo, useState } from 'react'
import snapshot from './chain-snapshot.json'

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'
const LIVE_TIMEOUT_MS = 3_800
const PROGRAM_ACTIVITY_TIMEOUT_MS = 4_800
const PROGRAM_ACTIVITY_BLOCK_COUNT = 40
const PROGRAM_ACTIVITY_RETRY_DELAY_MS = 450
const PROGRAM_ACTIVITY_SIGNATURE_PAGE_LIMIT = 1000
const PROGRAM_ACTIVITY_MAX_SIGNATURE_PAGES = 4
const HIGH_VOLUME_CACHED_BLOCK_THRESHOLD = 20
const MIN_LIVE_COVERAGE_RATIO = 0.5
const MIN_PLANET_RADIUS = 0.28
const MAX_PLANET_RADIUS = 0.62
const HELIUS_RPC_ORIGINS = {
  devnet: 'https://devnet.helius-rpc.com/',
  'mainnet-beta': 'https://mainnet.helius-rpc.com/',
} as const

export type DataSource = 'cached' | 'live'
export type ActivityCategory = 'defi' | 'token' | 'nft' | 'other'
export type SolanaCluster = keyof typeof HELIUS_RPC_ORIGINS

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

export type ProgramRollup = {
  appearedInSlots: number[]
  blockCount: number
  category: ActivityCategory
  name: string | null
  programId: string
  slotCounts?: Record<string, number>
  totalTxns: number
}

export type ProgramActivityBlock = {
  slot: number
  timestamp: string
  txCount: number
}

export type ProgramActivityResult = {
  blockWindow: number
  blocks: ProgramActivityBlock[]
  cluster: SolanaCluster
  elapsedMs: number
  name: string | null
  note?: string
  programId: string
  source: DataSource
  totalTxns: number
}

export type KnownProgramMetadata = {
  category: ActivityCategory
  name: string
}

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SOLANA_ADDRESS_CANDIDATE_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g

export type ParsedProgramInput = {
  cluster: SolanaCluster
  kind: 'account' | 'address' | 'program' | 'token'
  programId: string
}

const KNOWN_PROGRAM_METADATA = new Map<string, KnownProgramMetadata>([
  ['JUP2jxvS5ji3Yj2hfRCKW3tnL3hq6h3JNsxFYgNn3n9', { category: 'defi', name: 'Jupiter' }],
  ['JUP3c2Uhhu0g8Q6NDtY9CgzGbSadtWSJbAQGtD2q7SU', { category: 'defi', name: 'Jupiter' }],
  ['JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', { category: 'defi', name: 'Jupiter' }],
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', { category: 'defi', name: 'Jupiter' }],
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', { category: 'defi', name: 'Raydium AMM' }],
  ['CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', { category: 'defi', name: 'Raydium CLMM' }],
  ['CAMMCzo5YL8w4VFF8KVHrK22GGUQpVTaW7grrKgrWqK', { category: 'defi', name: 'Raydium CLMM' }],
  ['CPMMoo8L3F4NbTegBCKVNwbryeYbJ4YF9t4r5gn1s9y', { category: 'defi', name: 'Raydium CP' }],
  ['5quBtoiQqxF9J9tYNNQDPqBrVgbGpxRFNZbQeTeM2UZa', { category: 'defi', name: 'Raydium' }],
  ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', { category: 'defi', name: 'Orca Whirlpool' }],
  ['9W959DqEETiGZocYWCQPaJ6nK9joxTywcxSUGWNA3Y3r', { category: 'defi', name: 'Orca V2' }],
  ['PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', { category: 'defi', name: 'Phoenix' }],
  ['11111111111111111111111111111111', { category: 'token', name: 'System' }],
  ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', { category: 'token', name: 'SPL Token' }],
  ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', { category: 'token', name: 'Token-2022' }],
  ['M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', { category: 'nft', name: 'Magic Eden' }],
  ['TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp', { category: 'nft', name: 'Tensor' }],
  ['TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg', { category: 'nft', name: 'Tensor' }],
  ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', { category: 'nft', name: 'Metaplex' }],
])

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
  programs?: ProgramRollup[]
  topPrograms?: ProgramRollup[]
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

function getBlockTimestamp(slot: number, fallbackBlockTime?: number | null) {
  const snapshotFile = snapshot as SnapshotFile
  const blockTime =
    fallbackBlockTime ??
    snapshotFile.blocks.find((block) => block.slot === slot)?.blockTime ??
    null

  return formatBlockTime(blockTime)
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

let cachedBlockLookup: Map<number, ChainBlock> | null = null

export function getCachedBlockBySlot(slot: number) {
  if (!cachedBlockLookup) {
    cachedBlockLookup = new Map(
      normalizeBlocks(
        (snapshot as SnapshotFile).blocks,
        (snapshot as SnapshotFile).blocks.length,
      ).map((block) => [block.slot, block]),
    )
  }

  return cachedBlockLookup.get(slot) ?? null
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

export function getCachedProgramRollup() {
  const snapshotFile = snapshot as SnapshotFile

  return {
    blockCount: snapshotFile.blocks.length,
    programs: snapshotFile.programs ?? [],
    topPrograms: snapshotFile.topPrograms ?? [],
  }
}

export function getKnownProgramMetadata(programId: string) {
  return KNOWN_PROGRAM_METADATA.get(programId) ?? null
}

function normalizeCluster(cluster: string | null): SolanaCluster {
  return cluster?.toLowerCase() === 'devnet' ? 'devnet' : 'mainnet-beta'
}

export function parseProgramInputDetails(input: string): ParsedProgramInput {
  const trimmedInput = input.trim()

  if (!trimmedInput) {
    return { cluster: 'mainnet-beta', kind: 'address', programId: '' }
  }

  if (SOLANA_ADDRESS_PATTERN.test(trimmedInput)) {
    return { cluster: 'mainnet-beta', kind: 'address', programId: trimmedInput }
  }

  const candidates = new Set<string>()
  let cluster: SolanaCluster = 'mainnet-beta'
  let kind: ParsedProgramInput['kind'] = 'address'

  try {
    const url = new URL(trimmedInput)
    cluster = normalizeCluster(url.searchParams.get('cluster'))
    const pathParts = url.pathname.split('/').filter(Boolean)
    const pathKind = pathParts[0]?.toLowerCase()

    if (pathKind === 'token' || pathKind === 'account') {
      kind = pathKind
    } else if (pathKind === 'program') {
      kind = 'program'
    }

    const urlParts = [
      url.pathname,
      url.search,
      url.hash,
      ...url.searchParams.values(),
    ]

    for (const part of urlParts) {
      const matches = part.match(SOLANA_ADDRESS_CANDIDATE_PATTERN) ?? []

      for (const match of matches) {
        candidates.add(match)
      }
    }
  } catch {
    const matches = trimmedInput.match(SOLANA_ADDRESS_CANDIDATE_PATTERN) ?? []

    for (const match of matches) {
      candidates.add(match)
    }
  }

  const programId = [...candidates].find((candidate) =>
    SOLANA_ADDRESS_PATTERN.test(candidate),
  )

  return { cluster, kind, programId: programId ?? trimmedInput }
}

export function parseProgramInput(input: string) {
  return parseProgramInputDetails(input).programId
}

function getProgramName(programId: string) {
  const snapshotFile = snapshot as SnapshotFile
  return (
    snapshotFile.programs?.find((program) => program.programId === programId)
      ?.name ??
    getKnownProgramMetadata(programId)?.name ??
    null
  )
}

function getCachedProgramActivity(
  programId: string,
  elapsedMs: number,
  cluster: SolanaCluster = 'mainnet-beta',
  note?: string,
): ProgramActivityResult {
  if (cluster !== 'mainnet-beta') {
    return {
      blockWindow: 0,
      blocks: [],
      cluster,
      elapsedMs,
      name: getProgramName(programId),
      note:
        note ??
        'Live devnet activity was unavailable. There is no cached devnet snapshot for this demo.',
      programId,
      source: 'cached',
      totalTxns: 0,
    }
  }

  const snapshotFile = snapshot as SnapshotFile
  const program =
    snapshotFile.programs?.find((entry) => entry.programId === programId) ??
    snapshotFile.topPrograms?.find((entry) => entry.programId === programId) ??
    null
  const recentSlots = snapshotFile.blocks
    .map((block) => block.slot)
    .sort((slotA, slotB) => slotA - slotB)
    .slice(-PROGRAM_ACTIVITY_BLOCK_COUNT)
  const recentSlotSet = new Set(recentSlots)
  const blocks = Object.entries(program?.slotCounts ?? {})
    .map(([slot, txCount]) => ({
      slot: Number(slot),
      timestamp: getBlockTimestamp(Number(slot)),
      txCount,
    }))
    .filter((block) => recentSlotSet.has(block.slot))
    .sort((blockA, blockB) => blockB.slot - blockA.slot)
  const totalTxns = blocks.reduce((sum, block) => sum + block.txCount, 0)

  return {
    blockWindow: recentSlots.length,
    blocks,
    cluster,
    elapsedMs,
    name: program?.name ?? getProgramName(programId),
    note,
    programId,
    source: 'cached',
    totalTxns,
  }
}

function getSnapshotProgram(programId: string) {
  const snapshotFile = snapshot as SnapshotFile

  return (
    snapshotFile.programs?.find((entry) => entry.programId === programId) ??
    snapshotFile.topPrograms?.find((entry) => entry.programId === programId) ??
    null
  )
}

function shouldPreferCachedCoverage(
  programId: string,
  liveResult: ProgramActivityResult,
) {
  const program = getSnapshotProgram(programId)

  if (!program?.slotCounts || program.blockCount < HIGH_VOLUME_CACHED_BLOCK_THRESHOLD) {
    return false
  }

  const expectedCoverage = Math.min(PROGRAM_ACTIVITY_BLOCK_COUNT, program.blockCount)
  const minimumUsefulLiveBlocks = Math.ceil(
    expectedCoverage * MIN_LIVE_COVERAGE_RATIO,
  )

  return liveResult.blocks.length < minimumUsefulLiveBlocks
}

async function withAbortableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await operation(controller.signal)
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function fetchJsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  signal: AbortSignal,
) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: `${method}-${Date.now()}`,
      jsonrpc: '2.0',
      method,
      params,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')

    throw new Error(
      `${method} RPC request failed with ${response.status}: ${
        errorBody || response.statusText || 'No response body'
      }`,
    )
  }

  const payload = (await response.json()) as {
    error?: { message?: string }
    result?: T
  }

  if (payload.error) {
    throw new Error(
      `${method} RPC error: ${payload.error.message ?? 'Unknown RPC error'}`,
    )
  }

  return payload.result as T
}

type HeliusAsset = {
  content?: {
    metadata?: {
      name?: string
      symbol?: string
    }
  }
  token_info?: {
    symbol?: string
  }
}

function getHeliusAssetName(asset: HeliusAsset | null | undefined) {
  const metadataName = asset?.content?.metadata?.name?.trim()

  if (metadataName) {
    return metadataName
  }

  return (
    asset?.content?.metadata?.symbol?.trim() ??
    asset?.token_info?.symbol?.trim() ??
    null
  )
}

async function fetchLiveAccountName(
  rpcUrl: string,
  programId: string,
  signal: AbortSignal,
) {
  try {
    return getHeliusAssetName(
      await fetchJsonRpc<HeliusAsset>(
        rpcUrl,
        'getAsset',
        [{ id: programId }],
        signal,
      ),
    )
  } catch {
    return null
  }
}

async function fetchLiveProgramActivityOnce(
  programId: string,
  cluster: SolanaCluster,
  signal: AbortSignal,
) {
  const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY as string | undefined

  if (!heliusApiKey?.trim()) {
    throw new Error('VITE_HELIUS_API_KEY is not configured')
  }

  const rpcOrigin = HELIUS_RPC_ORIGINS[cluster]
  const rpcUrl = `${rpcOrigin}?api-key=${encodeURIComponent(
    heliusApiKey.trim(),
  )}`

  console.info(
    '[Blockchain Galaxy] attempting live fetch',
    {
      cluster,
      endpoint: `${rpcOrigin}?api-key=<redacted>`,
      hasKey: true,
      programId,
    },
  )
  const [latestSlot, liveName] = await Promise.all([
    fetchJsonRpc<number>(
      rpcUrl,
      'getSlot',
      [{ commitment: 'confirmed' }],
      signal,
    ),
    fetchLiveAccountName(rpcUrl, programId, signal),
  ])
  const slots =
    (await fetchJsonRpc<number[]>(
      rpcUrl,
      'getBlocks',
      [
        Math.max(0, latestSlot - PROGRAM_ACTIVITY_BLOCK_COUNT * 4),
        latestSlot,
        { commitment: 'confirmed' },
      ],
      signal,
    )) ?? []
  const recentSlots = slots.slice(-PROGRAM_ACTIVITY_BLOCK_COUNT)
  const recentSlotSet = new Set(recentSlots)
  const oldestRecentSlot = recentSlots[0] ?? latestSlot
  const signatures: Array<{
    blockTime?: number | null
    signature: string
    slot: number
  }> = []
  let beforeSignature: string | undefined

  for (let page = 0; page < PROGRAM_ACTIVITY_MAX_SIGNATURE_PAGES; page += 1) {
    const pageSignatures =
      (await fetchJsonRpc<
        Array<{
          blockTime?: number | null
          signature: string
          slot: number
        }>
      >(
        rpcUrl,
        'getSignaturesForAddress',
        [
          programId,
          {
            before: beforeSignature,
            commitment: 'confirmed',
            limit: PROGRAM_ACTIVITY_SIGNATURE_PAGE_LIMIT,
          },
        ],
        signal,
      )) ?? []

    signatures.push(...pageSignatures)

    const lastSignature = pageSignatures.at(-1)

    if (
      pageSignatures.length < PROGRAM_ACTIVITY_SIGNATURE_PAGE_LIMIT ||
      !lastSignature ||
      lastSignature.slot < oldestRecentSlot
    ) {
      break
    }

    beforeSignature = lastSignature.signature
  }
  const blocksBySlot = new Map<number, { blockTime: number | null; txCount: number }>()

  for (const signature of signatures) {
    if (!recentSlotSet.has(signature.slot)) {
      continue
    }

    const existingBlock = blocksBySlot.get(signature.slot) ?? {
      blockTime: signature.blockTime ?? null,
      txCount: 0,
    }

    existingBlock.txCount += 1
    if (!existingBlock.blockTime && signature.blockTime) {
      existingBlock.blockTime = signature.blockTime
    }
    blocksBySlot.set(signature.slot, existingBlock)
  }

  const activityBlocks = [...blocksBySlot.entries()]
    .map(([slot, block]) => ({
      slot,
      timestamp: getBlockTimestamp(slot, block.blockTime),
      txCount: block.txCount,
    }))
    .sort((blockA, blockB) => blockB.slot - blockA.slot)

  return {
    blockWindow: recentSlots.length,
    blocks: activityBlocks,
    cluster,
    elapsedMs: 0,
    name: getProgramName(programId) ?? liveName,
    programId,
    source: 'live' as const,
    totalTxns: activityBlocks.reduce((sum, block) => sum + block.txCount, 0),
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function fetchProgramActivity(
  programId: string,
  cluster: SolanaCluster = 'mainnet-beta',
): Promise<ProgramActivityResult> {
  const startedAt = window.performance.now()
  const normalizedProgramId = programId.trim()

  if (!normalizedProgramId) {
    return getCachedProgramActivity(
      normalizedProgramId,
      0,
      cluster,
      'Enter a program name or address to inspect recent activity.',
    )
  }

  try {
    const result = await withAbortableTimeout(async (signal) => {
      try {
        return await fetchLiveProgramActivityOnce(normalizedProgramId, cluster, signal)
      } catch (error) {
        console.warn('[Blockchain Galaxy] live fetch retrying', {
          error: error instanceof Error ? error.message : String(error),
          programId: normalizedProgramId,
        })

        if (signal.aborted) {
          throw error
        }

        await sleep(PROGRAM_ACTIVITY_RETRY_DELAY_MS)
        return fetchLiveProgramActivityOnce(normalizedProgramId, cluster, signal)
      }
    }, PROGRAM_ACTIVITY_TIMEOUT_MS)

    console.info('[Blockchain Galaxy] live succeeded', {
      blocks: result.blocks.length,
      elapsedMs: Math.round(window.performance.now() - startedAt),
      programId: normalizedProgramId,
      totalTxns: result.totalTxns,
    })

    if (shouldPreferCachedCoverage(normalizedProgramId, result)) {
      return getCachedProgramActivity(
        normalizedProgramId,
        Math.round(window.performance.now() - startedAt),
        cluster,
        'Live signatures under-sampled this high-volume program, so this system uses the cached slot-count snapshot for better block coverage.',
      )
    }

    return {
      ...result,
      elapsedMs: Math.round(window.performance.now() - startedAt),
    }
  } catch (error) {
    console.warn('[Blockchain Galaxy] live failed; falling back to cached', {
      error: error instanceof Error ? error.message : String(error),
      programId: normalizedProgramId,
    })

    return getCachedProgramActivity(
      normalizedProgramId,
      Math.round(window.performance.now() - startedAt),
      cluster,
      'Live RPC was unavailable, so this result came from the cached snapshot.',
    )
  }
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
