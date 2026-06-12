import type {
    ApiDecl, App, ComponentDecl, FieldDecl, Literal, ModelDecl, PageDecl, UiElement
} from '../language/generated/ast.js';
import {
    isA11yItem, isBrandItem, isPerfItem, isRefValue, isSecurityItem, isStringValue, isUxItem
} from '../language/generated/ast.js';
import {
    ProjectIRSchema,
    type ApiIR, type ComponentIR, type EntityIR, type ProjectIR, type RouteIR,
    type UiElementIR, type VibeIR
} from '../ir/ir.js';

export class TransformError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Vibe semantic errors:\n${issues.map(i => `  - ${i}`).join('\n')}`);
    }
}

export function transformToIR(app: App): ProjectIR {
    const issues: string[] = [];

    const vibe = transformVibe(app);
    const tokens = transformStyle(app);
    const schema = app.models.map(m => transformModel(m, issues));
    const apis = app.apis.map(a => transformApi(a, issues));
    const components = app.components.map(c => transformComponent(c, issues));
    const routes = app.pages.map(p => transformPage(p, app, issues));

    // --- cross-declaration semantic checks ---
    const routePaths = new Set<string>();
    for (const r of routes) {
        if (routePaths.has(r.path)) issues.push(`Duplicate route path "${r.path}"`);
        routePaths.add(r.path);
    }
    const apiKeys = new Set(apis.map(a => `${a.method} ${a.path}`));
    for (const r of routes) {
        for (const l of r.loaders) {
            if (!apiKeys.has(l.api)) {
                issues.push(`Page "${r.name}" loads from undeclared api "${l.api}"`);
            }
        }
        const bindings = new Set(r.loaders.map(l => l.bind));
        for (const s of r.sections) {
            if (!bindings.has(s.binding)) {
                issues.push(`Section "${s.name}" in page "${r.name}" iterates over "${s.binding}" which is not loaded by any \`load\` declaration`);
            }
        }
    }
    // 'regulated' security profile: every api must declare auth explicitly
    if (vibe.securityProfile === 'regulated') {
        for (const a of app.apis) {
            if (a.authDecls.length === 0) {
                issues.push(`security is "regulated": api ${a.method} ${a.path} must declare auth explicitly`);
            }
        }
    }

    if (issues.length > 0) throw new TransformError(issues);

    const ir = {
        meta: { name: app.name, version: '0.1.0', targets: ['web-nextjs'] },
        vibe,
        designSystem: { tokens },
        schema,
        apis,
        routes,
        components
    };

    // Zod is the gate: nothing leaves the compiler front-end unvalidated.
    const parsed = ProjectIRSchema.safeParse(ir);
    if (!parsed.success) {
        throw new TransformError(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
    }
    return parsed.data;
}

function literalValue(lit: Literal): string | number | boolean {
    switch (lit.$type) {
        case 'StringLit': return lit.value;
        case 'NumberLit': return lit.value;
        case 'BoolLit': return lit.value === 'true';
    }
}

function transformVibe(app: App): VibeIR {
    const vibe: VibeIR = {
        brandKeywords: [],
        uxPriorities: [],
        performanceBudgets: {},
        securityProfile: 'public'
    };
    for (const item of app.vibes.flatMap(v => v.items)) {
        if (isBrandItem(item)) {
            vibe.brandKeywords = item.value.split(/\s+/).filter(Boolean);
        } else if (isUxItem(item)) {
            vibe.uxPriorities = [...item.priorities];
        } else if (isA11yItem(item)) {
            vibe.accessibility = item.level;
        } else if (isPerfItem(item)) {
            for (const b of item.budgets) {
                vibe.performanceBudgets[b.metric] = b.value;
            }
        } else if (isSecurityItem(item)) {
            vibe.securityProfile = item.profile;
        }
    }
    return vibe;
}

function transformStyle(app: App): Record<string, string | number> {
    const tokens: Record<string, string | number> = {};
    for (const t of app.styles.flatMap(s => s.tokens)) {
        const v = literalValue(t.value);
        tokens[t.key] = typeof v === 'boolean' ? String(v) : v;
    }
    return tokens;
}

function transformModel(model: ModelDecl, issues: string[]): EntityIR {
    const fields = model.fields.map(f => transformField(model, f, issues));
    if (!fields.some(f => f.primaryKey)) {
        issues.push(`model ${model.name}: no field marked @id`);
    }
    return { kind: 'entity', name: model.name, fields };
}

function transformField(model: ModelDecl, field: FieldDecl, issues: string[]) {
    let primaryKey = false;
    let unique = false;
    let defaultFn: 'now' | 'uuid' | undefined;
    for (const attr of field.attrs) {
        switch (attr.name) {
            case 'id': primaryKey = true; break;
            case 'unique': unique = true; break;
            case 'default':
                if (attr.arg === 'now' || attr.arg === 'uuid') defaultFn = attr.arg;
                else issues.push(`model ${model.name}.${field.name}: unsupported @default(${attr.arg ?? ''})`);
                break;
            default:
                issues.push(`model ${model.name}.${field.name}: unknown attribute @${attr.name}`);
        }
    }
    if (primaryKey && field.type === 'uuid' && !defaultFn) defaultFn = 'uuid';
    return {
        name: field.name,
        type: field.type,
        primaryKey,
        unique,
        default: field.default ? literalValue(field.default) : undefined,
        defaultFn
    };
}

function transformApi(api: ApiDecl, issues: string[]): ApiIR {
    if (api.returnsDecls.length === 0) {
        issues.push(`api ${api.method} ${api.path}: missing \`returns\` declaration`);
    } else if (api.returnsDecls.length > 1) {
        issues.push(`api ${api.method} ${api.path}: multiple \`returns\` declarations - keep exactly one`);
    }
    if (api.authDecls.length > 1) {
        issues.push(`api ${api.method} ${api.path}: multiple \`auth\` declarations - keep exactly one`);
    }
    const returnsDecl = api.returnsDecls[0];
    const entity = returnsDecl?.entity.ref;
    if (returnsDecl && !entity) {
        issues.push(`api ${api.method} ${api.path}: returns references an unknown model`);
    }
    return {
        method: api.method,
        path: api.path,
        auth: api.authDecls[0]?.level ?? 'public',
        query: api.queries.flatMap(q => q.params).map(p => ({
            name: p.name,
            type: p.type,
            optional: p.optional || p.default !== undefined,
            default: p.default ? literalValue(p.default) : undefined
        })),
        returns: {
            entity: entity?.name ?? '<unresolved>',
            many: returnsDecl?.many ?? false
        }
    };
}

function transformComponent(comp: ComponentDecl, issues: string[]): ComponentIR {
    const params = comp.params.map(p => {
        const entity = p.entity.ref;
        if (!entity) issues.push(`component ${comp.name}: param "${p.name}" references an unknown model`);
        return { name: p.name, entity: entity?.name ?? '<unresolved>' };
    });
    const paramNames = new Set(params.map(p => p.name));
    const elements = comp.elements.map(e => transformElement(comp, e, paramNames, issues));
    return { name: comp.name, params, elements };
}

function transformElement(
    comp: ComponentDecl, el: UiElement, paramNames: Set<string>, issues: string[]
): UiElementIR {
    if (isStringValue(el.value)) {
        // interpolations like "/images/{product.slug}.jpg" must reference declared params
        for (const m of el.value.value.matchAll(/\{([a-zA-Z_][\w.]*)\}/g)) {
            const root = m[1].split('.')[0];
            if (!paramNames.has(root)) {
                issues.push(`component ${comp.name}: interpolation "{${m[1]}}" references unknown param "${root}"`);
            }
        }
        return { kind: el.kind, value: { type: 'string', value: el.value.value } };
    }
    if (isRefValue(el.value)) {
        const root = el.value.parts[0];
        if (!paramNames.has(root)) {
            issues.push(`component ${comp.name}: "${el.value.parts.join('.')}" references unknown param "${root}"`);
        }
        return { kind: el.kind, value: { type: 'ref', path: [...el.value.parts] } };
    }
    throw new Error('unreachable ui value');
}

function transformPage(page: PageDecl, app: App, issues: string[]): RouteIR {
    const loaders = page.loads.map(l => ({
        api: `${l.method} ${l.path}`,
        args: Object.fromEntries(l.args.map(a => [a.name, literalValue(a.value)])),
        bind: l.binding
    }));
    const sections = page.sections.map(s => {
        const comp = s.component.ref;
        if (!comp) issues.push(`page ${page.name}: section "${s.name}" references an unknown component`);
        return { name: s.name, component: comp?.name ?? '<unresolved>', binding: s.binding };
    });
    if (page.heroes.length > 1) {
        issues.push(`page ${page.name}: multiple \`hero\` blocks - keep exactly one`);
    }
    const hero = page.heroes[0];
    return {
        name: page.name,
        path: page.route,
        loaders,
        hero: hero ? { title: hero.title, cta: hero.cta } : undefined,
        sections
    };
}
