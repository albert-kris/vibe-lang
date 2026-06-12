import { z } from 'zod';

// ============================================================
// Project IR: the canonical, target-independent semantic center.
// Everything downstream (generators) consumes ONLY this structure,
// never the raw AST. Zod validation is the gate between the two.
// ============================================================

export const FieldTypeSchema = z.enum([
    'uuid', 'string', 'text', 'int', 'float', 'decimal', 'boolean', 'datetime'
]);

export const LiteralSchema = z.union([z.string(), z.number(), z.boolean()]);

export const EntityFieldSchema = z.object({
    name: z.string(),
    type: FieldTypeSchema,
    primaryKey: z.boolean().default(false),
    unique: z.boolean().default(false),
    default: LiteralSchema.optional(),
    // special defaults expressed as functions, e.g. now()
    defaultFn: z.enum(['now', 'uuid']).optional()
});

export const EntitySchema = z.object({
    kind: z.literal('entity'),
    name: z.string(),
    fields: z.array(EntityFieldSchema).min(1)
});

export const QueryParamSchema = z.object({
    name: z.string(),
    type: FieldTypeSchema,
    optional: z.boolean().default(false),
    default: LiteralSchema.optional()
});

export const ApiSchema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string().regex(/^\/.*/, 'API path must start with /'),
    auth: z.enum(['public', 'user', 'admin']),
    query: z.array(QueryParamSchema),
    returns: z.object({
        entity: z.string(),
        many: z.boolean()
    })
});

export const UiValueSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('string'), value: z.string() }),
    z.object({ type: z.literal('ref'), path: z.array(z.string()).min(1) })
]);

export const UiElementSchema = z.object({
    kind: z.enum(['image', 'heading', 'price', 'text', 'button']),
    value: UiValueSchema
});

export const ComponentIRSchema = z.object({
    name: z.string(),
    params: z.array(z.object({
        name: z.string(),
        entity: z.string()
    })).min(1),
    elements: z.array(UiElementSchema)
});

export const LoaderSchema = z.object({
    // "GET /api/products" - must match a declared api
    api: z.string(),
    args: z.record(z.string(), LiteralSchema),
    bind: z.string()
});

export const RouteSchema = z.object({
    name: z.string(),
    path: z.string().regex(/^\/.*/, 'Route path must start with /'),
    loaders: z.array(LoaderSchema),
    hero: z.object({
        title: z.string().optional(),
        cta: z.string().optional()
    }).optional(),
    sections: z.array(z.object({
        name: z.string(),
        component: z.string(),
        binding: z.string()
    }))
});

export const VibeIRSchema = z.object({
    brandKeywords: z.array(z.string()),
    uxPriorities: z.array(z.string()),
    accessibility: z.enum(['wcag-aa', 'wcag-aaa']).optional(),
    performanceBudgets: z.record(z.string(), z.number()),
    securityProfile: z.enum(['public', 'trusted', 'regulated']).default('public')
});

export const ProjectIRSchema = z.object({
    meta: z.object({
        name: z.string(),
        version: z.string(),
        targets: z.array(z.string())
    }),
    vibe: VibeIRSchema,
    designSystem: z.object({
        tokens: z.record(z.string(), z.union([z.string(), z.number()]))
    }),
    schema: z.array(EntitySchema),
    apis: z.array(ApiSchema),
    routes: z.array(RouteSchema),
    components: z.array(ComponentIRSchema)
});

export type FieldType = z.infer<typeof FieldTypeSchema>;
export type EntityField = z.infer<typeof EntityFieldSchema>;
export type EntityIR = z.infer<typeof EntitySchema>;
export type QueryParamIR = z.infer<typeof QueryParamSchema>;
export type ApiIR = z.infer<typeof ApiSchema>;
export type UiValueIR = z.infer<typeof UiValueSchema>;
export type UiElementIR = z.infer<typeof UiElementSchema>;
export type ComponentIR = z.infer<typeof ComponentIRSchema>;
export type LoaderIR = z.infer<typeof LoaderSchema>;
export type RouteIR = z.infer<typeof RouteSchema>;
export type VibeIR = z.infer<typeof VibeIRSchema>;
export type ProjectIR = z.infer<typeof ProjectIRSchema>;
