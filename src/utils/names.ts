export function pascalCase(input: string): string {
    return input
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(s => s[0].toUpperCase() + s.slice(1))
        .join('');
}

export function camelCase(input: string): string {
    const p = pascalCase(input);
    return p ? p[0].toLowerCase() + p.slice(1) : p;
}

export function kebabCase(input: string): string {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '');
}

/** "GET /api/products" -> "getApiProducts" */
export function queryFnName(method: string, path: string): string {
    return camelCase(`${method.toLowerCase()} ${path.replace(/[/{}]/g, ' ')}`);
}
