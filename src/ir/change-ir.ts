import { z } from 'zod';

// ============================================================
// Change IR: the validated form of a `change` declaration.
// This is the machine-readable "change plan" that an AI executor
// must obey and that the verifier checks diffs/commands against.
// ============================================================

export const ScopeRuleIRSchema = z.object({
    kind: z.enum(['allow', 'forbid']),
    pattern: z.string().min(1)
});

export const RequirementIRSchema = z.object({
    kind: z.enum(['add', 'remove', 'modify']),
    text: z.string().min(1)
});

export const AcceptanceIRSchema = z.object({
    kind: z.enum(['test', 'run']),
    value: z.string().min(1)
});

export const ChangeIRSchema = z.object({
    title: z.string().min(1),
    goal: z.string().min(1),
    scope: z.object({
        allow: z.array(z.string()).min(1, 'scope must contain at least one allow rule'),
        forbid: z.array(z.string())
    }),
    requirements: z.array(RequirementIRSchema).min(1),
    styleHints: z.array(z.string()),
    constraints: z.array(z.string()),
    acceptance: z.array(AcceptanceIRSchema).min(1),
    rollback: z.enum(['revert', 'manual']).optional()
});

export type ScopeRuleIR = z.infer<typeof ScopeRuleIRSchema>;
export type RequirementIR = z.infer<typeof RequirementIRSchema>;
export type AcceptanceIR = z.infer<typeof AcceptanceIRSchema>;
export type ChangeIR = z.infer<typeof ChangeIRSchema>;
