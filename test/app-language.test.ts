import { describe, expect, it } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createVibeServices } from '../src/language/vibe-module.js';
import type { Document } from '../src/language/generated/ast.js';
import { transformToIR, TransformError } from '../src/compile/to-ir.js';

const services = createVibeServices(EmptyFileSystem);
const parse = parseHelper<Document>(services.Vibe);

const VALID = `
app Demo {
  vibe {
    security regulated
  }

  model Product {
    id uuid @id
    title string
    createdAt datetime @default(now)
  }

  api GET "/api/products" {
    query { limit?: int = 10 }
    returns Product[]
    auth public
  }

  component Card(product: Product) {
    heading product.title
  }

  page Home "/" {
    load items from GET "/api/products" with { limit: 5 }
    section Grid uses Card for items
  }
}
`;

describe('app language', () => {
    it('parses and transforms a valid app declaration', async () => {
        const doc = await parse(VALID, { validation: true });
        const errors = (doc.diagnostics ?? []).filter(d => d.severity === 1);
        expect(errors, errors.map(e => e.message).join('; ')).toHaveLength(0);

        const ir = transformToIR(doc.parseResult.value.apps[0]);
        expect(ir.meta.name).toBe('Demo');
        expect(ir.schema[0].fields.find(f => f.name === 'id')?.primaryKey).toBe(true);
        expect(ir.apis[0].path).toBe('/api/products');
        expect(ir.routes[0].loaders[0]).toMatchObject({ api: 'GET /api/products', bind: 'items' });
    });

    it('rejects a model without @id and an undeclared api load', async () => {
        const doc = await parse(`
app Bad {
  model P { title string }
  api GET "/api/p" { returns P[] }
  page Home "/" {
    load xs from GET "/api/missing"
  }
}`, { validation: true });
        const app = doc.parseResult.value.apps[0];
        expect(() => transformToIR(app)).toThrow(TransformError);
        try {
            transformToIR(app);
        } catch (err) {
            const msg = (err as Error).message;
            expect(msg).toMatch(/no field marked @id/);
            expect(msg).toMatch(/undeclared api/);
        }
    });
});
