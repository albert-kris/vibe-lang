import { execSync } from 'node:child_process';

export interface ExecutorInvocation {
    template: string;
    promptFile: string;
    prompt: string;
    repoDir: string;
}

/** Render the executor command template by substituting placeholders. */
export function renderCommand(inv: ExecutorInvocation): string {
    return inv.template
        .replaceAll('{promptFile}', inv.promptFile)
        .replaceAll('{repo}', inv.repoDir)
        .replaceAll('{prompt}', JSON.stringify(inv.prompt));
}

/**
 * Run the configured AI executor inside the target repository.
 * The executor is any CLI capable of editing files from a prompt
 * (cursor-agent, claude, aider, a custom script, ...).
 */
export function runExecutor(inv: ExecutorInvocation): number {
    const command = renderCommand(inv);
    console.log(`\n> ${command}\n`);
    try {
        execSync(command, { cwd: inv.repoDir, stdio: 'inherit' });
        return 0;
    } catch (err: unknown) {
        return (err as { status?: number }).status ?? 1;
    }
}
