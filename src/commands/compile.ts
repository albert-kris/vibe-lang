import { join } from 'node:path';
import { loadVibeDocument } from '../compile/load.js';
import { transformChangeToIR } from '../compile/change-to-ir.js';
import { generateAgentPrompt, generatePlanJson } from '../generate/change-plan.js';
import { kebabCase } from '../utils/names.js';
import { flagValue, writeFiles } from './shared.js';

/** Compile `change` declarations into plan.json + agent-prompt.md. */
export async function cmdCompile(args: string[]): Promise<void> {
    const input = args[0];
    if (!input) {
        console.error('Usage: vibe compile <file.vibe> [--out <dir>]');
        process.exit(1);
    }
    const outRoot = flagValue(args, '--out', join('.vibe', 'build'));

    const document = await loadVibeDocument(input);
    if (document.changes.length === 0) {
        console.error(`${input}: no \`change\` declaration found.` +
            (document.apps.length > 0 ? ' (For `app` declarations use `vibe generate`.)' : ''));
        process.exit(1);
    }

    for (const change of document.changes) {
        const ir = transformChangeToIR(change);
        const outDir = join(outRoot, kebabCase(ir.title));
        await writeFiles(outDir, new Map([
            ['plan.json', generatePlanJson(ir)],
            ['agent-prompt.md', generateAgentPrompt(ir)]
        ]));
        console.log(`Compiled change "${ir.title}" -> ${outDir}`);
        console.log(`  allow: ${ir.scope.allow.length}  forbid: ${ir.scope.forbid.length}  requirements: ${ir.requirements.length}  acceptance: ${ir.acceptance.length}`);
    }
}
