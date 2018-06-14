import { webContents } from 'electron';
import * as memoize from 'memoizee';
// @ts-ignore: no declaration file
import * as pidtree from 'pidtree';
// @ts-ignore: no declaration file
import * as pidusage from 'pidusage';
import { Observable } from 'rxjs';

import extractURLDomain from './extractURLDomain';

// looks like Ectron does not give `getType` to webContents
interface overridenWebContents extends webContents {
  getType(): string;
}

export interface onProcessMetricsOptions {
  /** in ms */
  samplingInterval?: number;
}

export interface PidUsage {
  cpu: number;
  memory: number;
  ppid: number;
  pid: number;
  ctime: number;
  elapsed: number;
  timestamp: number;
}

let getPpid = (pid: number): Promise<number> => {
  return pidtree(pid, { root: true, advanced: true }).then(([{ ppid }]: PidUsage[]) => ppid);
};

getPpid = memoize(getPpid, { promise: true });

const getAppUsage = (pid: number): Promise<PidUsage[]> => {
  return getPpid(pid)
    .then((ppid: number) => pidtree(ppid, { root: true }))
    .then(pidusage)
    .then((usages: any) => Object.values(usages) as PidUsage[]);
};

let getSharedProcessMetricsPoller = (pid: number, samplingInterval: number) =>
  Observable.timer(0, samplingInterval)
    .map(() => Observable.fromPromise(getAppUsage(pid)))
    .mergeAll()
    .share();

getSharedProcessMetricsPoller = memoize(getSharedProcessMetricsPoller);

/**
 * Returns an Observable that emits Electron.ProcessMetrics[] on a regular interval.
 *
 * For a given `app` and a given `samplingInterval`, the returned observable is shared
 * for performance reasons.
 *
 * options.samplingInterval = 1000 (1s) by default
 * @param app
 * @param options
 */
export const onProcessMetrics = (pid: number, options: onProcessMetricsOptions): Observable<PidUsage[]> => {
  options = { samplingInterval: 1000, ...options };
  return getSharedProcessMetricsPoller(pid, options.samplingInterval);
};

export interface ExtendedProcessMetric extends Electron.ProcessMetric {
  webContents?: {
    type: string;
    id: number;
    pid: number;
    URL: string;
    URLDomain: string;
  }[];
}

const getExtendedAppMetrics = (app: Electron.App) => {
  const appMetrics = app.getAppMetrics();
  const allWebContents = webContents.getAllWebContents();
  const webContentsInfo = allWebContents.map((wc: overridenWebContents) => ({
    type: wc.getType(),
    id: wc.id,
    pid: wc.getOSProcessId(),
    URL: wc.getURL(),
    URLDomain: extractURLDomain(wc.getURL()),
  }));

  return appMetrics.map(proc => {
    const report: ExtendedProcessMetric = proc;

    const wc = webContentsInfo.find(wc => wc.pid === proc.pid);
    if (!wc) return report;

    report.webContents = [wc];

    return report;
  });
};

/**
 * Returns an Rx.Observable that emits reports of `ExtendedProcessMetric`
 * every `options.samplingInterval` ms.
 *
 * Default `options.samplingInterval` = 1000ms
 *
 * Compared to `onProcessMetrics` it adds data on the `webContents` associated
 * to the given process.
 *
 * @param app the electron app instance
 * @param options
 */
export const onExtendedProcessMetrics = (app: Electron.App, options: onProcessMetricsOptions = {}) =>
  Observable.interval(options.samplingInterval || 1000).map(() => {
    return getExtendedAppMetrics(app);
  });

export interface onExcessiveCPUUsageOptions extends onProcessMetricsOptions {
  /**Number of samples to consider */
  samplesCount?: number;
  /**CPU usage percent minimum to consider a sample exceeds CPU usage */
  percentCPUUsageThreshold?: number;
}

/**
 * Will emit an array `PidUsage` when a process exceeds the
 * `options.percentCPUUsageThreshold` on more than `options.samplesCount`
 * samples.
 *
 * Default `options.samplesCount` = 10
 * Default `options.percentCPUUsageThreshold` = 80
 *
 * @param pid the pid of the main process
 * @param options
 */
export const onExcessiveCPUUsageSimple = (pid: number, options: onExcessiveCPUUsageOptions) => {
  options = {
    samplesCount: 10,
    percentCPUUsageThreshold: 80,
    ...options,
  };

  return onProcessMetrics(pid, options)
    .map(appUsage => Observable.from(appUsage))
    .mergeAll()
    .groupBy(appUsage => appUsage.pid)
    .map(g => g.bufferCount(options.samplesCount))
    .mergeAll()
    .filter(processMetricsSamples => {
      const excessiveSamplesCount = processMetricsSamples.filter(p => p.cpu >= options.percentCPUUsageThreshold).length;
      return excessiveSamplesCount === processMetricsSamples.length;
    });
};

/**
 * Will emit an array `ExtendedProcessMetric` when a process exceeds the
 * `options.percentCPUUsageThreshold` on more than `options.samplesCount`
 * samples.
 *
 * Default `options.samplesCount` = 10
 * Default `options.percentCPUUsageThreshold` = 80
 *
 * @param app the electron app instance
 * @param options
 */
export const onExcessiveCPUUsage = (app: Electron.App, options: onExcessiveCPUUsageOptions) => {
  options = {
    samplesCount: 10,
    percentCPUUsageThreshold: 80,
    ...options
  };

  return onExtendedProcessMetrics(app, options)
    .map(report => Observable.from(report))
    .mergeAll()
    .groupBy(processMetric => processMetric.pid)
    .map(g => g.bufferCount(options.samplesCount)).mergeAll()
    .filter(processMetricsSamples => {
      const excessiveSamplesCount = processMetricsSamples
        .filter(p => p.cpu.percentCPUUsage >= options.percentCPUUsageThreshold).length;
      return excessiveSamplesCount == processMetricsSamples.length;
    })
}
