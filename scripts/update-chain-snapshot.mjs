import { Connection } from '@solana/web3.js'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const BLOCK_COUNT = 100
const BLOCK_BATCH_SIZE = 5
const BLOCK_BATCH_DELAY_MS = 350
const HELIUS_API_KEY_ENV = 'HELIUS_API_KEY'
const MAX_RATE_LIMIT_RETRIES = 5
const RETRY_BASE_DELAY_MS = 700
const REDACTED_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=<redacted>'
const PROGRAM_COUNTS = {
  defi: 0,
  infra: 0,
  token: 0,
  nft: 0,
  vote: 0,
  other: 0,
}
const CATEGORY_PROGRAMS = {
  defi: new Set([
    // Jupiter
    'JUP2jxvS5ji3Yj2hfRCKW3tnL3hq6h3JNsxFYgNn3n9',
    'JUP3c2Uhhu0g8Q6NDtY9CgzGbSadtWSJbAQGtD2q7SU',
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    // Raydium
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    'CAMMCzo5YL8w4VFF8KVHrK22GGUQpVTaW7grrKgrWqK',
    'CPMMoo8L3F4NbTegBCKVNwbryeYbJ4YF9t4r5gn1s9y',
    '5quBtoiQqxF9J9tYNNQDPqBrVgbGpxRFNZbQeTeM2UZa',
    // Orca
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    '9W959DqEETiGZocYWCQPaJ6nK9joxTywcxSUGWNA3Y3r',
    // Phoenix
    'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    // OpenBook / Serum / Meteora
    'srmqPvymJeFKQ4XrEN2o33bJ87fdLhRZSF6tJkQKzJr',
    '9xQeWvG816bUx9EPf7W6WMAaQ2X5rJjZA8tE7Rj1U4q',
    'opnb2LAfJYbCnR3Z6BhQGbn2zfgPioEFrB37LdkP7gj',
    'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
    'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
    // Pump.fun / high-volume token launch trading.
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
    'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
  ]),
  infra: new Set([
    'ComputeBudget111111111111111111111111111111',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
    'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
    // Pyth / Switchboard oracle plumbing.
    'FsJ3DXNqG5qK7oCehYV6hYchN9gkNoMPA54XfL4xneEJ',
    'pythWSZB3mUAmTYmYxCnLYVMjYQZEAy1GQ2a3UMW9Bu',
    'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT',
    'SWiTCH7qthXrT8Z4QYnrCzW2j4jCRmCKYQx2L5RMU7z',
    'SBondq48UwEj5FeVg72sJ7Jtvy5maZJbUfy4vcmZkYj',
    'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
  ]),
  token: new Set([
    '11111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  ]),
  nft: new Set([
    // Metaplex / compressed NFTs / marketplaces
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
    'BGUMAp9Gfw4G3ZsGv4PDv63kXbzjzEcbv9eGdXJqRzA',
    'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
    'TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp',
    'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg',
  ]),
  vote: new Set(['Vote111111111111111111111111111111111111111']),
}
const ACTIVITY_PRIORITY = ['defi', 'nft', 'token', 'other']
const PROGRAM_LABELS = new Map([
  ['JUP2jxvS5ji3Yj2hfRCKW3tnL3hq6h3JNsxFYgNn3n9', 'Jupiter'],
  ['JUP3c2Uhhu0g8Q6NDtY9CgzGbSadtWSJbAQGtD2q7SU', 'Jupiter'],
  ['JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', 'Jupiter'],
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter'],
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium'],
  ['CAMMCzo5YL8w4VFF8KVHrK22GGUQpVTaW7grrKgrWqK', 'Raydium'],
  ['CPMMoo8L3F4NbTegBCKVNwbryeYbJ4YF9t4r5gn1s9y', 'Raydium'],
  ['5quBtoiQqxF9J9tYNNQDPqBrVgbGpxRFNZbQeTeM2UZa', 'Raydium'],
  ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca'],
  ['9W959DqEETiGZocYWCQPaJ6nK9joxTywcxSUGWNA3Y3r', 'Orca'],
  ['PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', 'Phoenix'],
  ['11111111111111111111111111111111', 'System'],
  ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'SPL Token'],
  ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', 'Token-2022'],
  ['M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', 'Magic Eden'],
  ['TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp', 'Tensor'],
  ['TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg', 'Tensor'],
  ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', 'Metaplex'],
])

function cloneProgramCounts() {
  return { ...PROGRAM_COUNTS }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function loadLocalEnv() {
  try {
    const envFile = await readFile(resolve('.env'), 'utf8')

    for (const line of envFile.split(/\r?\n/)) {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const separatorIndex = trimmedLine.indexOf('=')

      if (separatorIndex === -1) {
        continue
      }

      const key = trimmedLine.slice(0, separatorIndex).trim()
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim()

      if (!key || process.env[key] !== undefined) {
        continue
      }

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}

async function getHeliusRpcUrl() {
  await loadLocalEnv()

  const heliusApiKey = process.env[HELIUS_API_KEY_ENV]?.trim()

  if (!heliusApiKey) {
    throw new Error(`${HELIUS_API_KEY_ENV} not set`)
  }

  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(heliusApiKey)}`
}

function isRateLimitError(error) {
  const message = String(error?.message ?? error)
  return /429|rate.?limit|too many requests/i.test(message)
}

async function withRateLimitRetry(label, operation) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isRateLimitError(error) || attempt === MAX_RATE_LIMIT_RETRIES) {
        throw error
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt
      console.warn(
        `${label} hit a rate limit; retrying in ${delayMs}ms (${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`,
      )
      await sleep(delayMs)
    }
  }

  throw new Error(`${label} failed after retry attempts`)
}

function keyToString(key) {
  if (!key) {
    return undefined
  }

  return typeof key === 'string' ? key : key.toString()
}

function getTransactionAccountKeys(transactionWithMeta) {
  const message = transactionWithMeta.transaction.message
  const loadedAddresses = transactionWithMeta.meta?.loadedAddresses

  return [
    ...(message.staticAccountKeys ?? message.accountKeys ?? []),
    ...(loadedAddresses?.writable ?? []),
    ...(loadedAddresses?.readonly ?? []),
  ].map(keyToString)
}

function getInstructionProgramId(instruction, accountKeys) {
  if (instruction.programId) {
    return keyToString(instruction.programId)
  }

  if (typeof instruction.programIdIndex === 'number') {
    return accountKeys[instruction.programIdIndex]
  }

  return undefined
}

function getTopLevelInstructions(transactionWithMeta) {
  const message = transactionWithMeta.transaction.message

  return message.compiledInstructions ?? message.instructions ?? []
}

function getInnerInstructions(transactionWithMeta) {
  return (
    transactionWithMeta.meta?.innerInstructions?.flatMap(
      (innerInstructionGroup) => innerInstructionGroup.instructions,
    ) ?? []
  )
}

function categorizeProgram(programId) {
  if (!programId) {
    return 'other'
  }

  for (const [category, programIds] of Object.entries(CATEGORY_PROGRAMS)) {
    if (programIds.has(programId)) {
      return category
    }
  }

  return 'other'
}

function summarizeProgramComposition(block) {
  const programCounts = cloneProgramCounts()
  const selectedProgramHits = new Map()
  let failedTransactions = 0

  for (const transactionWithMeta of block.transactions) {
    const accountKeys = getTransactionAccountKeys(transactionWithMeta)
    const instructions = [
      ...getTopLevelInstructions(transactionWithMeta),
      ...getInnerInstructions(transactionWithMeta),
    ]

    if (transactionWithMeta.meta?.err) {
      failedTransactions += 1
    }

    const transactionCategoryCounts = cloneProgramCounts()

    for (const instruction of instructions) {
      const programId = getInstructionProgramId(instruction, accountKeys)
      const category = categorizeProgram(programId)
      transactionCategoryCounts[category] += 1
    }

    const selectedActivityCategory = ACTIVITY_PRIORITY.find(
      (category) => transactionCategoryCounts[category] > 0,
    )

    if (selectedActivityCategory) {
      programCounts[selectedActivityCategory] += 1
      const selectedProgramId = instructions
        .map((instruction) =>
          getInstructionProgramId(instruction, accountKeys),
        )
        .find(
          (programId) =>
            categorizeProgram(programId) === selectedActivityCategory,
        )

      if (selectedProgramId) {
        const label =
          PROGRAM_LABELS.get(selectedProgramId) ?? selectedProgramId
        selectedProgramHits.set(
          label,
          (selectedProgramHits.get(label) ?? 0) + 1,
        )
      }
    } else if (transactionCategoryCounts.vote > 0) {
      programCounts.vote += 1
    } else if (transactionCategoryCounts.infra > 0) {
      programCounts.infra += 1
    } else {
      programCounts.other += 1
    }
  }

  const activityCounts = {
    defi: programCounts.defi,
    token: programCounts.token,
    nft: programCounts.nft,
    other: programCounts.other,
  }
  const dominantCategory = Object.entries(activityCounts).sort(
    ([, countA], [, countB]) => countB - countA,
  )[0][0]
  const activityTotal =
    activityCounts.defi +
    activityCounts.token +
    activityCounts.nft +
    activityCounts.other
  const categoryMix = Object.fromEntries(
    Object.entries(activityCounts).map(([category, count]) => [
      category,
      activityTotal === 0 ? 0 : Number((count / activityTotal).toFixed(4)),
    ]),
  )
  const failedTxRatio =
    block.transactions.length === 0
      ? 0
      : Number((failedTransactions / block.transactions.length).toFixed(4))

  return {
    categoryMix,
    dominantProgram:
      [...selectedProgramHits.entries()].sort(([, countA], [, countB]) => countB - countA)[0]?.[0] ??
      undefined,
    dominantCategory,
    failedTxRatio,
    programCounts,
  }
}

const startedAt = Date.now()
const rpcUrl = await getHeliusRpcUrl()
const connection = new Connection(rpcUrl, 'confirmed')
const latestSlot = await withRateLimitRetry('getSlot', () =>
  connection.getSlot('confirmed'),
)
const slots = await withRateLimitRetry('getBlocks', () =>
  connection.getBlocks(
    Math.max(0, latestSlot - BLOCK_COUNT * 5),
    latestSlot,
    'confirmed',
  ),
)
const recentSlots = slots.slice(-BLOCK_COUNT)
const blocks = []

for (let index = 0; index < recentSlots.length; index += BLOCK_BATCH_SIZE) {
  const slotBatch = recentSlots.slice(index, index + BLOCK_BATCH_SIZE)
  const batchBlocks = await Promise.all(
    slotBatch.map(async (slot) => {
      const block = await withRateLimitRetry(`getBlock ${slot}`, () =>
        connection.getBlock(slot, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
          transactionDetails: 'full',
        }),
      )

      if (!block) {
        return null
      }

      return {
        blockTime: block.blockTime,
        slot,
        transactions: block.transactions.length,
        ...summarizeProgramComposition(block),
      }
    }),
  )

  blocks.push(...batchBlocks.filter((block) => block !== null))

  if (index + BLOCK_BATCH_SIZE < recentSlots.length) {
    console.log(`Fetched ${blocks.length}/${recentSlots.length} blocks...`)
    await sleep(BLOCK_BATCH_DELAY_MS)
  }
}

if (blocks.length !== recentSlots.length) {
  console.warn(
    `Expected ${recentSlots.length} blocks but fetched ${blocks.length}; skipped unavailable slots.`,
  )
}

const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
console.log(
  `Fetched ${blocks.length} blocks from Helius in ${elapsedSeconds}s using batches of ${BLOCK_BATCH_SIZE}.`,
)

const snapshot = {
  generatedAt: new Date().toISOString(),
  network: 'solana-mainnet-beta',
  rpcUrl: REDACTED_RPC_URL,
  blocks,
}
const outputPath = resolve('src/data/chain-snapshot.json')

await writeFile(`${outputPath}.tmp`, `${JSON.stringify(snapshot, null, 2)}\n`)
await rename(`${outputPath}.tmp`, outputPath)
console.log(`Wrote ${snapshot.blocks.length} blocks to ${outputPath}`)
