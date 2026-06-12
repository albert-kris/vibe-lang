import { cmdInit } from './commands/init.js';
import { cmdCompile } from './commands/compile.js';
import { cmdRun } from './commands/run.js';
import { cmdVerify } from './commands/verify.js';
import { cmdGenerate } from './commands/generate.js';
import { TransformError } from './compile/to-ir.js';
import { ParseFailure } from './compile/load.js';

const HELP = `vibe - a language for AI-driven code maintenance

Usage:
  vibe init [--repo <dir>]                      scaffold .vibe/ in a repository
  vibe compile <file.vibe> [--out <dir>]        compile change declarations to plans
  vibe run <change.vibe> [options]              execute a change end-to-end
  vibe verify <plan.json> [--repo <dir>] [--json]   check a repo against a change plan
  vibe generate <app.vibe> [--out <dir>]        bootstrap a project from an app declaration

Run options:
  --repo <dir>          target repository (default: .)
  --executor "<cmd>"    AI executor command template (overrides .vibe/config.json)
                        placeholders: {promptFile} {prompt} {repo}
  --max-attempts <n>    execute-verify-retry budget (default: 2)
  --allow-dirty         skip the clean-working-tree requirement
  --dry-run             compile and show the executor command without running it

A Vibefile (change declaration) encodes what to change, which files may be
touched, which must not, and how success is verified. The executor is any
AI coding CLI; the verifier enforces the boundaries afterwards.`;

async function main() {
    const [, , command, ...rest] = process.argv;
    switch (command) {
        case 'init': return cmdInit(rest);
        case 'compile': return cmdCompile(rest);
        case 'run': return cmdRun(rest);
        case 'verify': return cmdVerify(rest);
        case 'generate': return cmdGenerate(rest);
        case '--help': case '-h': case 'help': case undefined:
            console.log(HELP);
            return;
        default:
            console.error(`Unknown command: ${command}\n`);
            console.log(HELP);
            process.exit(1);
    }
}

main().catch(err => {
    if (err instanceof TransformError || err instanceof ParseFailure) {
        console.error(err.message);
    } else {
        console.error(err);
    }
    process.exit(1);
});
