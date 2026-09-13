type FpasotermPluginApi = {
  version: string;
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
    plugins: {
      enabled: string[];
    };
  };
  log: (message: string) => void;
  /** Reads plain UTF-8 text from the native system clipboard. */
  readClipboard: () => Promise<string>;
  /** Writes plain UTF-8 text to the native system clipboard. */
  writeClipboard: (text: string) => Promise<void>;
  /** Opens an HTTP(S) URL in the external browser after a plugin's explicit user action. */
  openExternalUrl: (url: string) => Promise<void>;
  /**
   * Opens the native file chooser from a direct user action and returns only
   * the selected file's metadata and bytes. It never exposes a path, directory
   * handle, or persistent filesystem permission. `maxBytes` is capped at 64 MiB.
   */
  selectLocalAsset: (options?: {
    accept?: string[];
    maxBytes?: number;
  }) => Promise<{
    name: string;
    mediaType: string;
    size: number;
    bytes: ArrayBuffer;
  } | null>;
  /** Opens a focus-trapped canvas modal; `confirmClose` asks before closing. */
  openCanvasOverlay: (options?: {
    title?: string;
    width?: number;
    height?: number;
    confirmClose?: boolean;
  }) => {
    canvas: HTMLCanvasElement;
    close: () => void;
    focus: () => void;
  };
  /** Opens a focus-trapped HTTPS iframe panel for this plugin's declared, application-approved origins. */
  openWebPanel: (options: {
    title?: string;
    url: string;
    width?: number;
    height?: number;
  }) => {
    close: () => void;
    focus: () => void;
  };
  getOfficialPluginIndex: () => Promise<Array<{
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    license: string;
    minFpasotermVersion: string;
    installPath: string;
  }>>;
  onReady: (callback: () => void) => void;
  registerCommand: (
    id: string,
    title: string,
    /** Receives the JSON value passed by `fpasoterm --plugin-run <id> --plugin-args <json>`. */
    handler: (args?: unknown) => void | Promise<void>,
  ) => void;
};

declare global {
  interface Window {
    fpasotermPluginApi: FpasotermPluginApi;
  }
}

export {};
