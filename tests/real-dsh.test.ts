import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import * as native from '../src/plugin.js'

test('real DSH 0.1.7-rc.2 executes the shared resolver and unregisters on disposal', async () => {
  const ctx = new Context()
  const prompt = await ctx.plugin(SystemPrompt)
  const tools = await ctx.plugin(ToolRuntime)
  const plugin = await ctx.plugin(native)
  try {
    const input = { name: 'native_capability', callId: ToolCallId('verify'),
      signal: new AbortController().signal, arguments: { task: 'manage plugins' } }
    const result = await ctx.tools.execute(input)
    assert.equal(result.isError, false, JSON.stringify(result))
    if (result.isError) throw new Error(result.error.message)
    assert.equal((result.value as { capability: string }).capability, 'plugin_manager')
    await plugin.dispose()
    assert.equal((await ctx.tools.execute(input)).isError, true)
  } finally {
    await plugin.dispose()
    await tools.dispose()
    await prompt.dispose()
  }
})
