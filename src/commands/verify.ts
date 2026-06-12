import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ChangeIRSchema } from '../ir/change-ir.js';
import { formatReport, verifyPlan } from '../verify/verify.js';
import { flagValue, hasFlag } from './shared.js';

export async function cmdVerify(args: string[]): Promise<void> {
    const planPath = args[0];
    if (!planPath) {
        console.error('Usage: vibe verify <plan.json> [--repo <dir>] [--json]');
        process.exit(1);
    }
    const repoDir = resolve(flagValue(args, '--repo', '.'));

    const raw = JSON.parse(await readFile(resolve(planPath), 'utf-8'));
    const parsed = ChangeIRSchema.safeParse(raw.plan ?? raw);
    if (!parsed.success) {
        console.error(`${planPath} is not a valid change plan:`);
        for (const i of parsed.error.issues) console.error(`  ${i.path.join('.')}: ${i.message}`);
        process.exit(1);
    }

    const result = verifyPlan(parsed.data, repoDir);
    if (hasFlag(args, '--json')) {
        console.log(JSON.stringify({
            passed: result.passed,
            changedFiles: result.changedFiles,
            violations: result.violations,
            commands: result.commandResults,
            manualChecks: result.manualChecks
        }, null, 2));
    } else {
        console.log(formatReport(result));
    }
    process.exit(result.passed ? 0 : 1);
}
