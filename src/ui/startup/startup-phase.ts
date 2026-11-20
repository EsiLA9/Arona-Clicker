export interface StartupPhaseReporter {
  begin(id: string, label: string, detail?: string): void;
  complete(id: string): void;
  work?(id: string): void;
}

export interface StartupTiming {
  id: string;
  label: string;
  state: string;
  durationMs: number;
  percent: number;
  beforeWorkMs?: number;
  workMs?: number;
  waitingFor?: string;
}

export interface StartupServerWork {
  path: string;
  kind: 'request' | 'css' | 'esbuild' | 'imports';
  durationMs: number;
}

export interface StartupServerTiming {
  pendingCount: number;
  pending: StartupServerWork[];
  recentSlow: StartupServerWork[];
}

interface StartupResourceTiming {
  path: string;
  startMs: number;
  endMs: number;
  totalMs: number;
  preRequestMs: number;
  dnsMs: number;
  connectMs: number;
  responseWaitMs: number;
  downloadMs: number;
  protocol: string;
}

export interface StartupLogReport {
  state: string;
  totalMs: number;
  otherMs: number;
  otherPercent: number;
  phases: StartupTiming[];
  /** Parallel imports overlap; these percentages must not be added to phase percentages. */
  tasks: StartupTiming[];
  storageError?: string;
  resources?: StartupResourceTiming[];
  moduleResources?: { count: number; slowest: StartupResourceTiming[] };
  moduleServerTiming?: StartupServerTiming & { sampledAtMs: number };
}

export interface StartupLog {
  report(previous?: number): StartupLogReport | undefined;
  print(previous?: number): StartupLogReport | undefined;
  taskBegin(label: string): void;
  taskEnd(label: string, error?: unknown): void;
  requestServerTiming?: () => void;
  captureServerTiming(sample: StartupServerTiming): void;
}

export async function runStartupPhase<T>(
  reporter: StartupPhaseReporter | undefined,
  id: string,
  label: string,
  beforeWork: () => Promise<void>,
  work: () => T | Promise<T>,
  detail?: string,
): Promise<T> {
  reporter?.begin(id, label, detail);
  await beforeWork();
  reporter?.work?.(id);
  const result = await work();
  reporter?.complete(id);
  return result;
}
