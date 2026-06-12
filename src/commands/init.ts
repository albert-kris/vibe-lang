import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { flagValue } from './shared.js';

const EXAMPLE_CHANGE = `// Example Vibefile. Edit it, then execute with:
//   vibe run .vibe/changes/example.vibe

change "example change" {
  goal "Describe what this change should accomplish"

  scope {
    allow "src/**"
  }

  requirements {
    "First concrete requirement"
  }

  acceptance {
    "Observable behavior that proves success"
    run "npm test"
  }

  rollback revert
}
`;

const DEFAULT_CONFIG_JSON = `{
  "executor": null,
  "maxAttempts": 2,
  "$comment": "Set executor to a shell command template, e.g. cursor-agent -p \\"$(cat {promptFile})\\" - placeholders: {promptFile} {prompt} {repo}"
}
`;

const GITIGNORE_BLOCK = `
# vibe-lang local artifacts (change plans and run logs are regenerated)
.vibe/build/
.vibe/runs/
`;

export async function cmdInit(args: string[]): Promise<void> {
    const repoDir = resolve(flagValue(args, '--repo', '.'));
    const vibeDir = join(repoDir, '.vibe');

    await mkdir(join(vibeDir, 'changes'), { recursive: true });
    await writeIfMissing(join(vibeDir, 'config.json'), DEFAULT_CONFIG_JSON);
    await writeIfMissing(join(vibeDir, 'changes', 'example.vibe'), EXAMPLE_CHANGE);

    // append ignore rules for local artifacts
    const gitignore = join(repoDir, '.gitignore');
    let current = '';
    try { current = await readFile(gitignore, 'utf-8'); } catch { /* no .gitignore yet */ }
    if (!current.includes('.vibe/runs/')) {
        await writeFile(gitignore, current + GITIGNORE_BLOCK, 'utf-8');
    }

    console.log(`Initialized .vibe/ in ${repoDir}`);
    console.log('  .vibe/config.json          executor configuration');
    console.log('  .vibe/changes/example.vibe sample Vibefile (version this directory)');
    console.log('\nNext: edit the Vibefile, then `vibe run .vibe/changes/example.vibe`');
}

async function writeIfMissing(path: string, content: string): Promise<void> {
    try {
        await readFile(path, 'utf-8');
    } catch {
        await writeFile(path, content, 'utf-8');
    }
}
