import { join } from 'node:path';
import { loadVibeDocument } from '../compile/load.js';
import { transformToIR } from '../compile/to-ir.js';
import { generateProject } from '../generate/index.js';
import { kebabCase } from '../utils/names.js';
import { flagValue, writeFiles } from './shared.js';

/**
 * Secondary capability: bootstrap a project from an `app` declaration.
 * The core of vibe-lang is maintaining code via `change` files; `generate`
 * exists to give a change-driven workflow something to start from.
 */
export async function cmdGenerate(args: string[]): Promise<void> {
    const input = args[0];
    if (!input) {
        console.error('Usage: vibe generate <app.vibe> [--out <dir>]');
        process.exit(1);
    }
    const outRoot = flagValue(args, '--out', 'out');

    const document = await loadVibeDocument(input);
    if (document.apps.length === 0) {
        console.error(`${input}: no \`app\` declaration found. (For \`change\` declarations use \`vibe run\` or \`vibe compile\`.)`);
        process.exit(1);
    }

    for (const app of document.apps) {
        const ir = transformToIR(app);
        const files = generateProject(ir);
        const outDir = join(outRoot, kebabCase(ir.meta.name));
        await writeFiles(outDir, files);
        console.log(`Generated app "${ir.meta.name}" -> ${outDir}`);
        console.log(`  models: ${ir.schema.length}  apis: ${ir.apis.length}  pages: ${ir.routes.length}  components: ${ir.components.length}  files: ${files.size}`);
    }
}
