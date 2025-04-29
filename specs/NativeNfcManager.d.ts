import type { TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    echo(value: string): string;
}
declare const _default: Spec;
export default _default;
