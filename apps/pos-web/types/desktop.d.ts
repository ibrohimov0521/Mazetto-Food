type DesktopUpdateStatus = {
  state:
    | "disabled"
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "up-to-date"
    | "error";
  version: string | null;
  percent: number | null;
  message: string | null;
  checkedAt: string | null;
};

type DesktopPrinterStatus = { configured: boolean; host: string | null; port: number };

type DesktopBridge = {
  printer?: {
    status: () => Promise<DesktopPrinterStatus>;
    save: (input: { host: string; port: number }) => Promise<DesktopPrinterStatus>;
    test: () => Promise<void>;
  };
  updates?: {
    getStatus: () => Promise<DesktopUpdateStatus>;
    check: () => Promise<DesktopUpdateStatus>;
    download: () => Promise<DesktopUpdateStatus>;
    install: () => Promise<DesktopUpdateStatus>;
    onStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
  };
};

declare global {
  interface Window {
    mazettoDesktop?: DesktopBridge;
  }
}

export {};
