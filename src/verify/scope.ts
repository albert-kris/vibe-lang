import { execFileSync } from 'node:child_process';
import type { ChangeIR } from '../ir/change-ir.js';

// ============================================================
// Scope verifier: checks that the files actually changed in a
// git working tree respect the allow/forbid rules of a change
// plan, then runs the acceptance commands.
// ============================================================

/**
 * Convert a scope glob to a RegExp.
 *   `**` matches any number of path segments, `*` matches within a segment.
 * Patterns and file paths are normalized to forward slashes.
 */
export function globToRegExp(pattern: string): RegExp {
    const normalized = pattern.replace(/\\/g, '/');
    let re = '';
    for (let i = 0; i < normalized.length; i++) {
        const c = normalized[i];
        if (c === '*') {
            if (normalized[i + 1] === '*') {
                re += '.*';
                i++;
                if (normalized[i + 1] === '/') i++; // "**/" also matches zero segments
            } else {
                re += '[^/]*';
            }
        } else if ('.+?^${}()|[]'.includes(c)) {
            re += '\\' + c;
        } else {
            re += c;
        }
    }
    return new RegExp(`^${re}$`);
}

export interface ScopeViolation {
    file: string;
    reason: 'forbidden' | 'out-of-scope';
    pattern?: string;
}

export function checkScope(plan: ChangeIR, changedFiles: string[]): ScopeViolation[] {
    const allowRes = plan.scope.allow.map(p => ({ p, re: globToRegExp(p) }));
    const forbidRes = plan.scope.forbid.map(p => ({ p, re: globToRegExp(p) }));
    const violations: ScopeViolation[] = [];

    for (const raw of changedFiles) {
        const file = raw.replace(/\\/g, '/');
        const forbidden = forbidRes.find(f => f.re.test(file));
        if (forbidden) {
            // forbid always wins, even if an allow pattern also matches
            violations.push({ file, reason: 'forbidden', pattern: forbidden.p });
            continue;
        }
        if (!allowRes.some(a => a.re.test(file))) {
            violations.push({ file, reason: 'out-of-scope' });
        }
    }
    return violations;
}

/** Changed files (staged + unstaged + untracked) of a git working tree. */
export function gitChangedFiles(repoDir: string): string[] {
    const out = execFileSync('git', ['status', '--porcelain'], { cwd: repoDir, encoding: 'utf-8' });
    const files: string[] = [];
    for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        // format: "XY path" or "XY old -> new" for renames
        let path = line.slice(3).trim();
        const arrow = path.indexOf(' -> ');
        if (arrow >= 0) path = path.slice(arrow + 4);
        files.push(path.replace(/^"|"$/g, ''));
    }
    return files;
}

export interface CommandResult {
    command: string;
    ok: boolean;
    exitCode: number;
}

export function runAcceptanceCommands(plan: ChangeIR, repoDir: string): CommandResult[] {
    const results: CommandResult[] = [];
    for (const item of plan.acceptance) {
        if (item.kind !== 'run') continue;
        let exitCode = 0;
        try {
            execFileSync(item.value, {
                cwd: repoDir,
                encoding: 'utf-8',
                shell: true,
                stdio: ['ignore', 'inherit', 'inherit']
            });
        } catch (err: unknown) {
            exitCode = (err as { status?: number }).status ?? 1;
        }
        results.push({ command: item.value, ok: exitCode === 0, exitCode });
    }
    return results;
}
