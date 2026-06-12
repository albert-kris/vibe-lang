import type { ProjectIR } from '../ir/ir.js';
import { generatePrismaSchema } from './prisma.js';
import { generateQueriesFile } from './queries.js';
import { apiFilePath, generateRouteHandler } from './api.js';
import { generateComponent } from './components.js';
import { generatePage, pageFilePath } from './pages.js';
import {
    generateAppPackageJson, generateAppTsconfig, generateBudgetsJson, generateDbClient,
    generateEnvExample, generateGitignore, generateGlobalsCss, generateLayout
} from './scaffold.js';

/** Lower the Project IR into a full Next.js project: path -> file content. */
export function generateProject(ir: ProjectIR): Map<string, string> {
    const files = new Map<string, string>();

    // scaffold
    files.set('package.json', generateAppPackageJson(ir));
    files.set('tsconfig.json', generateAppTsconfig());
    files.set('.gitignore', generateGitignore());
    files.set('.env.example', generateEnvExample());
    files.set('vibe.budgets.json', generateBudgetsJson(ir));
    files.set('vibe.ir.json', JSON.stringify(ir, null, 2) + '\n');

    // data layer
    files.set('prisma/schema.prisma', generatePrismaSchema(ir));
    files.set('src/lib/db.ts', generateDbClient());
    files.set('src/lib/queries.ts', generateQueriesFile(ir));

    // app shell
    files.set('src/app/layout.tsx', generateLayout(ir));
    files.set('src/app/globals.css', generateGlobalsCss(ir));

    // apis
    for (const api of ir.apis) {
        files.set(apiFilePath(api), generateRouteHandler(ir, api));
    }

    // components
    for (const comp of ir.components) {
        files.set(`src/components/${comp.name}.tsx`, generateComponent(ir, comp));
    }

    // pages
    for (const route of ir.routes) {
        files.set(pageFilePath(route), generatePage(ir, route));
    }

    return files;
}
