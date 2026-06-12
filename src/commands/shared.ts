import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export function flagValue(args: string[], flag: string, fallback: string): string {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

export function hasFlag(args: string[], flag: string): boolean {
    return args.includes(flag);
}

export async function writeFiles(outDir: string, files: Map<string, string>): Promise<void> {
    for (const [relPath, content] of files) {
        const abs = resolve(outDir, relPath);
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content, 'utf-8');
    }
}
