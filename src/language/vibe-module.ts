import {
    createDefaultCoreModule,
    createDefaultSharedCoreModule,
    inject,
    type DefaultSharedCoreModuleContext,
    type LangiumCoreServices,
    type LangiumSharedCoreServices
} from 'langium';
import { VibeGeneratedModule, VibeGeneratedSharedModule } from './generated/module.js';

export type VibeServices = LangiumCoreServices;

export function createVibeServices(context: DefaultSharedCoreModuleContext): {
    shared: LangiumSharedCoreServices;
    Vibe: VibeServices;
} {
    const shared = inject(createDefaultSharedCoreModule(context), VibeGeneratedSharedModule);
    const Vibe = inject(createDefaultCoreModule({ shared }), VibeGeneratedModule);
    shared.ServiceRegistry.register(Vibe);
    return { shared, Vibe };
}
