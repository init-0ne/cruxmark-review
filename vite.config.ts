import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { keccak256 } from 'viem'

const artifact = JSON.parse(readFileSync('contracts/out/ScenarioFactory.sol/ScenarioFactory.json', 'utf8'))
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.CRUXMARK_REVISION': JSON.stringify(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()),
    'import.meta.env.CRUXMARK_DIRTY': JSON.stringify(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() ? 'true' : 'false'),
    'import.meta.env.CRUXMARK_FACTORY_CODE_HASH': JSON.stringify(keccak256(artifact.deployedBytecode.object)),
  },
})
