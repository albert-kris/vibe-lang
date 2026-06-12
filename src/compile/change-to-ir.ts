import type { ChangeDecl } from '../language/generated/ast.js';
import { ChangeIRSchema, type ChangeIR } from '../ir/change-ir.js';
import { TransformError } from './to-ir.js';

export function transformChangeToIR(change: ChangeDecl): ChangeIR {
    const issues: string[] = [];

    // repeated blocks of the same kind are merged in declaration order
    const scopeRules = change.scopes.flatMap(s => s.rules);
    const allow = scopeRules.filter(r => r.kind === 'allow').map(r => r.pattern);
    const forbid = scopeRules.filter(r => r.kind === 'forbid').map(r => r.pattern);

    if (change.scopes.length === 0) {
        issues.push(`change "${change.title}": missing \`scope\` block - an AI change without file boundaries is not executable`);
    } else if (allow.length === 0) {
        issues.push(`change "${change.title}": scope has no \`allow\` rule - nothing would be editable`);
    }

    // identical pattern both allowed and forbidden is a contradiction
    for (const p of allow) {
        if (forbid.includes(p)) {
            issues.push(`change "${change.title}": pattern "${p}" is both allowed and forbidden`);
        }
    }

    const requirements = change.requirementBlocks
        .flatMap(b => b.items)
        .map(i => ({ kind: i.kind ?? 'add' as const, text: i.text }));
    if (requirements.length === 0) {
        issues.push(`change "${change.title}": missing \`requirements\` - the executor needs concrete instructions`);
    }

    const acceptance = change.acceptanceBlocks
        .flatMap(b => b.items)
        .map(i => ({ kind: i.kind ?? 'test' as const, value: i.value }));
    if (acceptance.length === 0) {
        issues.push(`change "${change.title}": missing \`acceptance\` - a change without verification criteria cannot be trusted`);
    }

    if (change.rollbacks.length > 1) {
        issues.push(`change "${change.title}": multiple \`rollback\` declarations - keep exactly one`);
    }

    if (issues.length > 0) throw new TransformError(issues);

    const ir = {
        title: change.title,
        goal: change.goal,
        scope: { allow, forbid },
        requirements,
        styleHints: change.styleBlocks.flatMap(b => [...b.hints]),
        constraints: change.constraintBlocks.flatMap(b => [...b.items]),
        acceptance,
        rollback: change.rollbacks[0]?.strategy
    };

    const parsed = ChangeIRSchema.safeParse(ir);
    if (!parsed.success) {
        throw new TransformError(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
    }
    return parsed.data;
}
