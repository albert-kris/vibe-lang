import { describe, expect, it } from 'vitest';
import { checkScope } from '../src/verify/scope.js';
import type { ChangeIR } from '../src/ir/change-ir.js';

function plan(allow: string[], forbid: string[]): ChangeIR {
    return {
        title: 't', goal: 'g',
        scope: { allow, forbid },
        requirements: [{ kind: 'add', text: 'r' }],
        styleHints: [], constraints: [],
        acceptance: [{ kind: 'run', value: 'true' }],
        rollback: undefined
    };
}

describe('checkScope', () => {
    it('accepts files matching an allow pattern', () => {
        const p = plan(['src/**'], []);
        expect(checkScope(p, ['src/app/page.tsx'])).toEqual([]);
    });

    it('flags files matching no allow pattern as out-of-scope', () => {
        const p = plan(['src/app/**'], []);
        const v = checkScope(p, ['scripts/build.js']);
        expect(v).toHaveLength(1);
        expect(v[0]).toMatchObject({ file: 'scripts/build.js', reason: 'out-of-scope' });
    });

    it('forbid wins even when an allow pattern also matches', () => {
        const p = plan(['src/**'], ['src/server/auth/**']);
        const v = checkScope(p, ['src/server/auth/session.ts']);
        expect(v).toHaveLength(1);
        expect(v[0]).toMatchObject({ reason: 'forbidden', pattern: 'src/server/auth/**' });
    });

    it('normalizes windows paths from git output', () => {
        const p = plan(['src/**'], []);
        expect(checkScope(p, ['src\\app\\page.tsx'])).toEqual([]);
    });

    it('reports each offending file once with the matching rule', () => {
        const p = plan(['src/**'], ['prisma/**']);
        const v = checkScope(p, ['prisma/schema.prisma', 'random.txt', 'src/ok.ts']);
        expect(v).toHaveLength(2);
        expect(v.map(x => x.reason).sort()).toEqual(['forbidden', 'out-of-scope']);
    });
});
