import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  echo(value: string, callback: (err?: string, resp?: string) => void): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeNfcManager');
