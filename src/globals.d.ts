declare const __HUBB_VERSION__: string;

interface Window {
  customCards?: Array<{ type: string; name: string; description?: string; preview?: boolean }>;
  customStrategies?: Array<{
    type: string;
    strategyType: 'dashboard' | 'view';
    name: string;
    description?: string;
    documentationURL?: string;
  }>;
}
