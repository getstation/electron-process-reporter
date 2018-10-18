import { webContents } from 'electron';
import * as memoize from 'memoizee';
// @ts-ignore: no declaration file
import * as pidtree from 'pidtree';
// @ts-ignore: no declaration file
import * as pidusage from 'pidusage';
import { Observable } from 'rxjs';

import extractURLDomain from './extractURLDomain';

// looks like Electron does not give `getType` to webContents
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
  pid: number;
  ppid: number;
  ctime: number;
  elapsed: number;
  timestamp: number;
}

export const getAppUsage = (pid: number): Promise<PidUsage[]> => {
  return pidtree(pid, { root: true })
    .then(pidusage)
    .then((usages: any) => Object.values(usages).filter(Boolean) as PidUsage[]);
};

let getSharedProcessMetricsPollerByPid = (pid: number, samplingInterval: number) =>
  Observable.timer(0, samplingInterval)
    .map(() => Observable.fromPromise(getAppUsage(pid)))
    .mergeAll()
    .share();

getSharedProcessMetricsPollerByPid = memoize(getSharedProcessMetricsPollerByPid);

let getSharedProcessMetricsPollerByApp = (app: Electron.App, samplingInterval: number) =>
  Observable.timer(0, samplingInterval)
    .map(() => app.getAppMetrics())
    .share();

getSharedProcessMetricsPollerByApp = memoize(getSharedProcessMetricsPollerByApp);

/**
 * Returns an Observable that emits Electron.ProcessMetric[] on a regular interval.
 *
 * For a given `app` and a given `samplingInterval`, the returned observable is shared
 * for performance reasons.
 *
 * options.samplingInterval = 1000 (1s) by default
 * @param app
 * @param options
 */
export const onProcessMetrics = (
  app: Electron.App,
  options: onProcessMetricsOptions
): Observable<Electron.ProcessMetric[]> => {
  options = { samplingInterval: 1000, ...options };
  return getSharedProcessMetricsPollerByApp(app, options.samplingInterval);
};

/**
 * Returns an Rx.Observable that emits `PidUsage[]` every `options.samplingInterval` ms.
 *
 * For a given `pid` and a given `samplingInterval`, the returned observable is shared
 * for performance reasons.
 * `pid` is the root of the process tree.
 *
 * @param pid
 * @param {object} options
 * @param {number} options.samplingInterval - 1000 (1s) by default
 *
 * @example
 * - pid: main process
 *   - rendererPid1: renderer process
 *   - rendererPid2: renderer process
 */
export const onProcessTreeMetricsForPid = (
  pid: number,
  options: onProcessMetricsOptions
): Observable<PidUsage[]> => {
  options = { samplingInterval: 1000, ...options };
  return getSharedProcessMetricsPollerByPid(pid, options.samplingInterval);
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

const getExtendedAppMetrics = (appMetrics: Electron.ProcessMetric[]) => {
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
  onProcessMetrics(app, options).map(getExtendedAppMetrics);

export interface onExcessiveCPUUsageOptions extends onProcessMetricsOptions {
  /**Number of samples to consider */
  samplesCount?: number;
  /**CPU usage percent minimum to consider a sample exceeds CPU usage */
  percentCPUUsageThreshold?: number;
}

/**
 * Will emit an array of `PidUsage` when a process of the tree exceeds the
 * `options.percentCPUUsageThreshold` on more than `options.samplesCount`
 * samples.
 * It monitors the whole tree of pids, starting from `childPid`.
 * The reason behind this is that the `process.pid` of the main process is at the same
 * level as all renderers.
 * So we fetch their common ancestor, which is the `ppid` of the main process.
 * The parent pid of `childPid` is not part of the end result
 * (that way, we monitor the same processes as `getAppMetrics`).
 *
 * In opposite to onExcessiveCPUUsage, onExcessiveCPUUsageInProcessTree does not use
 * Electron's internal measurement but rather use `pidusage`, a cross-platform
 * process cpu % and memory usage of a PID. It is known to have lower pressure on CPU.
 * Also, as this leverage `pidusage`, the measures on Windows can be considered
 * as not accurate.
 *
 * Default `options.samplesCount` = 10
 * Default `options.percentCPUUsageThreshold` = 80
 *
 * @param pid - the pid of the main process
 * @param options
 */
export const onExcessiveCPUUsageInProcessTree = (pid: number, options: onExcessiveCPUUsageOptions) => {
  options = {
    samplesCount: 10,
    percentCPUUsageThreshold: 80,
    ...options,
  };

  return onProcessTreeMetricsForPid(pid, options)
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
    ...options,
  };

  return onExtendedProcessMetrics(app, options)
    .map(report => Observable.from(report))
    .mergeAll()
    .groupBy(processMetric => processMetric.pid)
    .map(g => g.bufferCount(options.samplesCount))
    .mergeAll()
    .filter(processMetricsSamples => {
      const excessiveSamplesCount = processMetricsSamples.filter(
        p => p.cpu.percentCPUUsage >= options.percentCPUUsageThreshold
      ).length;
      return excessiveSamplesCount == processMetricsSamples.length;
    });
};
