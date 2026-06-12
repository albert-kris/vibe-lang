import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadVibeDocument } from '../compile/load.js';
import { transformChangeToIR } from '../compile/change-to-ir.js';
import { generateAgentPrompt, generatePlanJson } from '../generate/change-plan.js';
import { loadConfig } from '../executor/config.js';
import { runExecutor } from '../executor/executor.js';
import { gitChangedFiles } from '../verify/scope.js';
import { formatReport, verifyPlan, type VerifyResult } from '../verify/verify.js';
import { kebabCase } from '../utils/names.js';
import { flagValue, hasFlag } from './shared.js';

// ============================================================
// vibe run: the full closed loop.
//   Vibefile -> plan + prompt -> AI executor edits the repo ->
//   verify (scope + acceptance) -> retry with failure report ->
//   PASS, or FAIL (+ optional rollback).
// ============================================================

export async function cmdRun(args: string[]): Promise<void> {
    const input = args[0];
    if (!input) {
        console.error('Usage: vibe run <change.vibe> [--repo <dir>] [--executor "<cmd>"] [--max-attempts N] [--allow-dirty] [--dry-run]');
        process.exit(1);
    }
    const repoDir = resolve(flagValue(args, '--repo', '.'));
    const config = await loadConfig(repoDir);
    const executor = flagValue(args, '--executor', config.executor ?? '');
    const maxAttempts = parseInt(flagValue(args, '--max-attempts', String(config.maxAttempts)), 10);
    const dryRun = hasFlag(args, '--dry-run');

    // 1. compile the Vibefile (exactly one change per run)
    const document = await loadVibeDocument(input);
    if (document.changes.length !== 1) {
        console.error(`${input}: \`vibe run\` expects exactly one \`change\` declaration, found ${document.changes.length}`);
        process.exit(1);
    }
    const plan = transformChangeToIR(document.changes[0]);
    const prompt = generateAgentPrompt(plan);

    // 2. require a clean tree so the verify diff is exactly the AI's work
    if (!hasFlag(args, '--allow-dirty') && gitChangedFiles(repoDir).length > 0) {
        console.error(`Working tree at ${repoDir} is not clean. Commit or stash first (or pass --allow-dirty).`);
        console.error('A clean baseline is required so that verification sees only the AI\'s changes.');
        process.exit(1);
    }

    // 3. persist run artifacts
    const runDir = join(repoDir, '.vibe', 'runs', kebabCase(plan.title));
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'plan.json'), generatePlanJson(plan), 'utf-8');
    const promptFile = join(runDir, 'agent-prompt.md');
    await writeFile(promptFile, prompt, 'utf-8');
    console.log(`Run "${plan.title}"  (artifacts: ${runDir})`);

    if (!executor) {
        console.log('\nNo executor configured (.vibe/config.json `executor` or --executor).');
        console.log('Manual mode:');
        console.log(`  1. Give this prompt to your AI coding tool:  ${promptFile}`);
        console.log(`  2. After it finishes:  vibe verify ${join(runDir, 'plan.json')} --repo ${repoDir}`);
        return;
    }
    if (dryRun) {
        console.log('\n--dry-run: executor command that would run on each attempt:');
        console.log(`  ${executor.replaceAll('{promptFile}', promptFile).replaceAll('{repo}', repoDir)}`);
        return;
    }

    // 4. execute-verify-retry loop
    let result: VerifyResult | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\n=== Attempt ${attempt}/${maxAttempts} ===`);

        let attemptPrompt = prompt;
        let attemptPromptFile = promptFile;
        if (result) {
            // feed the previous failure back to the executor
            attemptPrompt = `${prompt}\n\n## Previous attempt FAILED verification\n\nFix the following and re-satisfy every acceptance criterion:\n\n\`\`\`\n${formatReport(result)}\n\`\`\`\n`;
            attemptPromptFile = join(runDir, `agent-prompt-attempt${attempt}.md`);
            await writeFile(attemptPromptFile, attemptPrompt, 'utf-8');
        }

        const exit = runExecutor({
            template: executor,
            promptFile: attemptPromptFile,
            prompt: attemptPrompt,
            repoDir
        });
        if (exit !== 0) console.warn(`Executor exited with code ${exit}; verifying anyway.`);

        result = verifyPlan(plan, repoDir);
        await writeFile(join(runDir, `verify-attempt${attempt}.txt`), formatReport(result), 'utf-8');
        console.log('\n' + formatReport(result));

        if (result.passed) {
            console.log(`\nRUN PASSED after ${attempt} attempt(s). Review the diff and commit.`);
            if (result.manualChecks.length > 0) {
                console.log('Reminder: behavioral checks above still need a human or E2E suite.');
            }
            return;
        }
    }

    // 5. final failure: optional rollback
    console.error(`\nRUN FAILED after ${maxAttempts} attempt(s).`);
    if (plan.rollback === 'revert') {
        console.error('Rollback strategy is `revert`: restoring tracked files...');
        execFileSync('git', ['checkout', '--', '.'], { cwd: repoDir });
        const leftover = gitChangedFiles(repoDir);
        if (leftover.length > 0) {
            console.error('Untracked files left for manual review:');
            for (const f of leftover) console.error(`  ${f}`);
        }
    } else {
        console.error('Rollback strategy is `manual`: changes left in place for inspection.');
    }
    process.exit(1);
}
