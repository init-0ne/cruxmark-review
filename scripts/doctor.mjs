import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

let failed = false
for (const [label, command, args] of [
  ['Node', 'node', ['--version']],
  ['Git', 'git', ['--version']],
  ['Forge', 'forge', ['--version']],
  ['Anvil', 'anvil', ['--version']],
  ['Cast', 'cast', ['--version']],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  const ok = result.status === 0
  failed ||= !ok
  console.log(`${ok ? 'OK' : 'MISSING'} ${label}: ${ok ? result.stdout.trim().split('\n')[0] : 'Run npm ci from the project root.'}`)
}
for (const file of ['AGENTS.md', '.agents/skills/cruxmark-build/SKILL.md', 'docs/PRODUCT.md', 'docs/HACKATHON.md', 'docs/ARCHITECTURE.md', 'docs/BUILD_PLAN.md', 'docs/AGENT_SETUP.md', 'docs/STATUS.md']) {
  const ok = existsSync(file)
  failed ||= !ok
  console.log(`${ok ? 'OK' : 'MISSING'} ${file}`)
}
if (Number(process.versions.node.split('.')[0]) !== 24) {
  failed = true
  console.log('Use Node 24; the tested version is in .nvmrc.')
}
console.log('This checks local setup. It does not certify deployment, a wallet balance, or plugin connections.')
process.exitCode = failed ? 1 : 0
