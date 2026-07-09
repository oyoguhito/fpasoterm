type fpasotermPluginApi = {
  terminal: {
    options: Record<string, unknown>;
    write: (data: string) => void;
    writeln: (data: string) => void;
    focus: () => void;
  };
  fitAddon: {
    fit: () => void;
  };
  config: {
    window: {
      width: number;
      height: number;
      minWidth: number;
      minHeight: number;
      backgroundColor: string;
      themeSource: 'system' | 'light' | 'dark';
    };
    terminal: Record<string, unknown>;
    ime: {
      duplicateGuard: boolean;
      duplicateWindowMs: number;
      repeatedTextWindowMs: number;
    };
    plugins: {
      enabled: string[];
    };
  };
  log: (message: string) => void;
};

declare global {
  interface Window {
    fpasotermPluginApi: fpasotermPluginApi;
  }
}

export {};
