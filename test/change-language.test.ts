import { describe, expect, it } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createVibeServices } from '../src/language/vibe-module.js';
import type { Document } from '../src/language/generated/ast.js';
import { transformChangeToIR } from '../src/compile/change-to-ir.js';
import { TransformError } from '../src/compile/to-ir.js';
import { generateAgentPrompt } from '../src/generate/change-plan.js';

const services = createVibeServices(EmptyFileSystem);
const parse = parseHelper<Document>(services.Vibe);

async function parseChange(source: string) {
    const doc = await parse(source, { validation: true });
    const errors = (doc.diagnostics ?? []).filter(d => d.severity === 1);
    expect(errors, errors.map(e => e.message).join('; ')).toHaveLength(0);
    return doc.parseResult.value.changes[0];
}

const VALID = `
change "add product search" {
  goal "Add title search to the product list"

  scope {
    allow "src/app/page.tsx"
    allow "src/components/**"
    forbid "prisma/**"
  }

  requirements {
    add "Search input at the top of the page"
    modify "Filter products by title"
  }

  constraints {
    "no new dependency"
  }

  acceptance {
    test "typing a keyword filters the list"
    run "npm run typecheck"
  }

  rollback revert
}
`;

describe('change language', () => {
    it('parses and transforms a valid change declaration', async () => {
        const change = await parseChange(VALID);
        const ir = transformChangeToIR(change);

        expect(ir.title).toBe('add product search');
        expect(ir.scope.allow).toEqual(['src/app/page.tsx', 'src/components/**']);
        expect(ir.scope.forbid).toEqual(['prisma/**']);
        expect(ir.requirements).toEqual([
            { kind: 'add', text: 'Search input at the top of the page' },
            { kind: 'modify', text: 'Filter products by title' }
        ]);
        expect(ir.acceptance).toContainEqual({ kind: 'run', value: 'npm run typecheck' });
        expect(ir.rollback).toBe('revert');
    });

    it('supports bare-string sugar: requirement defaults to add, acceptance to test', async () => {
        const change = await parseChange(`
change "minimal" {
  goal "g"
  scope { allow "src/**" }
  requirements {
    "show a search box"
    remove "the old banner"
  }
  acceptance {
    "typing filters the list"
    run "npm test"
  }
}`);
        const ir = transformChangeToIR(change);
        expect(ir.requirements).toEqual([
            { kind: 'add', text: 'show a search box' },
            { kind: 'remove', text: 'the old banner' }
        ]);
        expect(ir.acceptance).toEqual([
            { kind: 'test', value: 'typing filters the list' },
            { kind: 'run', value: 'npm test' }
        ]);
    });

    it('rejects a change without scope', async () => {
        const change = await parseChange(`
change "x" {
  goal "g"
  requirements { add "r" }
  acceptance { run "true" }
}`);
        expect(() => transformChangeToIR(change)).toThrow(TransformError);
        expect(() => transformChangeToIR(change)).toThrow(/scope/);
    });

    it('rejects a change without acceptance', async () => {
        const change = await parseChange(`
change "x" {
  goal "g"
  scope { allow "src/**" }
  requirements { add "r" }
}`);
        expect(() => transformChangeToIR(change)).toThrow(/acceptance/);
    });

    it('rejects contradictory scope rules', async () => {
        const change = await parseChange(`
change "x" {
  goal "g"
  scope {
    allow "src/**"
    forbid "src/**"
  }
  requirements { add "r" }
  acceptance { run "true" }
}`);
        expect(() => transformChangeToIR(change)).toThrow(/both allowed and forbidden/);
    });

    it('generates a deterministic agent prompt containing the hard boundary', async () => {
        const change = await parseChange(VALID);
        const ir = transformChangeToIR(change);
        const prompt1 = generateAgentPrompt(ir);
        const prompt2 = generateAgentPrompt(ir);

        expect(prompt1).toBe(prompt2);
        expect(prompt1).toContain('HARD BOUNDARY');
        expect(prompt1).toContain('FORBID `prisma/**`');
        expect(prompt1).toContain('npm run typecheck');
        expect(prompt1).toContain('STOP and report');
    });
});
