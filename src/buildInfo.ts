import type { Hash } from 'viem'
export const buildInfo = {
  revision: import.meta.env.CRUXMARK_REVISION as string,
  dirty: import.meta.env.CRUXMARK_DIRTY === 'true',
  compiler: '0.8.30', evmVersion: 'paris', optimizerRuns: 200,
  factoryCodeHash: import.meta.env.CRUXMARK_FACTORY_CODE_HASH as Hash,
}
