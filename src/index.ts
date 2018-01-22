import { Observable } from 'rxjs';
import { webContents } from 'electron';

import extractURLDomain from './extractURLDomain';
import { ExtendedProcessMetric } from './index';

// looks like Ectron does not give `getType` to webContents
interface overridenWebContents extends webContents {
  getType(): string
}

export interface onProcessMetricsOptions{ 
  /** in ms */
  samplingInterval?: number
}

export const onProcessMetrics = (app: Electron.App, options: onProcessMetricsOptions) => {
  options = { samplingInterval: 1000, ...options };
  return Observable
    .timer(0, options.samplingInterval)
    .map(() => app.getAppMetrics());
}
    

export interface ExtendedProcessMetric extends Electron.ProcessMetric {
  webContents?: {
    type: string,
    id: number,
    pid: number,
    URL: string,
    URLDomain: string
  }[]
}

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
  onProcessMetrics(app, options)
    .map(appMetrics => {
      const allWebContents = webContents.getAllWebContents();
      const webContentsInfo = allWebContents.map((wc: overridenWebContents) => ({
        type: wc.getType(),
        id: wc.id,
        pid: wc.getOSProcessId(),
        URL: wc.getURL(),
        URLDomain: extractURLDomain(wc.getURL())
      }));

      return appMetrics.map(proc => {
        const report = proc as ExtendedProcessMetric;

        const wc = webContentsInfo.find(wc => wc.pid === proc.pid);
        if (!wc) return report;

        report.webContents = [];
        report.webContents.push(wc);

        return report
    })
  });

export interface onExcessiveCPUUsageOptions extends onProcessMetricsOptions {
  /**Number of samples to consider */
  samplesCount?: number
  /**CPU usage percent minimum to consider a sample exceeds CPU usage */
  percentCPUUsageThreshold?: number
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
