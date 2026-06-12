import { describe, expect, it } from 'vitest';
import { globToRegExp } from '../src/verify/scope.js';

describe('globToRegExp', () => {
    it('matches exact paths', () => {
        const re = globToRegExp('src/app/page.tsx');
        expect(re.test('src/app/page.tsx')).toBe(true);
        expect(re.test('src/app/page.ts')).toBe(false);
        expect(re.test('src/app/other.tsx')).toBe(false);
    });

    it('** matches any depth', () => {
        const re = globToRegExp('src/components/**');
        expect(re.test('src/components/Card.tsx')).toBe(true);
        expect(re.test('src/components/nested/deep/Card.tsx')).toBe(true);
        expect(re.test('src/app/page.tsx')).toBe(false);
    });

    it('leading **/ matches zero or more segments', () => {
        const re = globToRegExp('**/route.ts');
        expect(re.test('route.ts')).toBe(true);
        expect(re.test('src/app/api/products/route.ts')).toBe(true);
        expect(re.test('src/app/api/products/route.tsx')).toBe(false);
    });

    it('single * stays within one segment', () => {
        const re = globToRegExp('src/*.ts');
        expect(re.test('src/index.ts')).toBe(true);
        expect(re.test('src/lib/index.ts')).toBe(false);
    });

    it('escapes regex metacharacters', () => {
        const re = globToRegExp('src/file.test.ts');
        expect(re.test('src/file.test.ts')).toBe(true);
        expect(re.test('src/fileXtestYts')).toBe(false);
    });

    it('normalizes backslashes', () => {
        const re = globToRegExp('src\\app\\**');
        expect(re.test('src/app/page.tsx')).toBe(true);
    });
});
