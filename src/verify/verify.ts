import type { ChangeIR } from '../ir/change-ir.js';
import {
    checkScope, gitChangedFiles, runAcceptanceCommands,
    type CommandResult, type ScopeViolation
} from './scope.js';

export interface VerifyResult {
    plan: ChangeIR;
    changedFiles: string[];
    violations: ScopeViolation[];
    commandResults: CommandResult[];
    /** behavioral `test` items that still require a human or E2E harness */
    manualChecks: string[];
    passed: boolean;
}

/** Pure verification pipeline: scope check over git diff + acceptance commands. */
export function verifyPlan(plan: ChangeIR, repoDir: string): VerifyResult {
    const changedFiles = gitChangedFiles(repoDir);
    const violations = checkScope(plan, changedFiles);
    const commandResults = runAcceptanceCommands(plan, repoDir);
    const manualChecks = plan.acceptance.filter(a => a.kind === 'test').map(a => a.value);
    const passed = violations.length === 0 && commandResults.every(r => r.ok);
    return { plan, changedFiles, violations, commandResults, manualChecks, passed };
}

/** Human-readable report, also fed back to the AI executor on retry. */
export function formatReport(result: VerifyResult): string {
    const lines: string[] = [];
    lines.push(`Verify "${result.plan.title}": ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`Changed files: ${result.changedFiles.length}`);

    if (result.violations.length > 0) {
        lines.push('');
        lines.push(`Scope violations (${result.violations.length}):`);
        for (const v of result.violations) {
            lines.push(v.reason === 'forbidden'
                ? `  ${v.file}  -> matches forbid "${v.pattern}"`
                : `  ${v.file}  -> matches no allow pattern`);
        }
    } else {
        lines.push('Scope check: OK');
    }

    for (const r of result.commandResults) {
        lines.push(`${r.ok ? 'PASS' : 'FAIL'} (exit ${r.exitCode})  ${r.command}`);
    }

    if (result.manualChecks.length > 0) {
        lines.push('');
        lines.push('Behavioral checks (manual / E2E):');
        for (const t of result.manualChecks) lines.push(`  [ ] ${t}`);
    }
    return lines.join('\n');
}
