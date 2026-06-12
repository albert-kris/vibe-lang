import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

// .vibe/config.json - per-repository configuration for the AI executor.
//
// `executor` is a shell command template with placeholders:
//   {promptFile} absolute path of the generated agent prompt (markdown)
//   {prompt}     the prompt content itself (quoted)
//   {repo}       absolute path of the target repository
//
// Examples:
//   "cursor-agent -p --output-format text \"$(cat {promptFile})\""
//   "claude -p \"$(cat {promptFile})\" --permission-mode acceptEdits"

export const VibeConfigSchema = z.object({
    // null = "not configured yet" (the default scaffolded config)
    executor: z.string().min(1).nullish().transform(v => v ?? undefined),
    maxAttempts: z.number().int().min(1).max(10).default(2)
});

export type VibeConfig = z.infer<typeof VibeConfigSchema>;

export const DEFAULT_CONFIG: VibeConfig = { executor: undefined, maxAttempts: 2 };

export async function loadConfig(repoDir: string): Promise<VibeConfig> {
    try {
        const raw = await readFile(join(repoDir, '.vibe', 'config.json'), 'utf-8');
        const parsed = VibeConfigSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
            throw new Error(`.vibe/config.json is invalid:\n${parsed.error.issues
                .map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
        }
        return parsed.data;
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG;
        throw err;
    }
}
