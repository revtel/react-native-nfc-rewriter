import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  readDocument(uri: string, requestId: string): Promise<string>;
  createExport(text: string, requestId: string): Promise<{token: string; uri: string}>;
  releaseExport(token: string): Promise<void>;
  cancel(requestId: string): void;
  cleanupExports(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RecordDocumentIO');
