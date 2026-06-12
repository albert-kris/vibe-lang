import { resolve } from 'node:path';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createVibeServices } from '../language/vibe-module.js';
import type { Document } from '../language/generated/ast.js';

export class ParseFailure extends Error {
    constructor(public readonly file: string, public readonly details: string[]) {
        super(`Parse/validation errors in ${file}:\n${details.map(d => `  ${d}`).join('\n')}`);
    }
}

/** Parse and validate a .vibe file, returning the typed document root. */
export async function loadVibeDocument(path: string): Promise<Document> {
    const services = createVibeServices(NodeFileSystem);
    const doc = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(
        URI.file(resolve(path))
    );
    await services.shared.workspace.DocumentBuilder.build([doc], { validation: true });

    const errors = (doc.diagnostics ?? []).filter(d => d.severity === 1);
    if (errors.length > 0) {
        throw new ParseFailure(path, errors.map(e =>
            `${e.range.start.line + 1}:${e.range.start.character + 1} ${e.message}`));
    }
    return doc.parseResult.value as Document;
}
