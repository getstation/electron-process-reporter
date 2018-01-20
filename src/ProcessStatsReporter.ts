import { EventEmitter } from 'events';
import { app, webContents } from 'electron';

import extractURLDomain from './extractURLDomain';

interface overridenWebContents extends webContents {
  getType(): string
}

export interface ProcessMetricReport extends Electron.ProcessMetric {
  webContents: {
    type: string,
    id: number,
    pid: number,
    URL: string,
    URLDomain: string
  }[]
}

declare interface ProcessStatsReporter extends EventEmitter {
  on(event: 'report', listener: (report: ProcessMetricReport) => any): this;
}

class ProcessStatsReporter extends EventEmitter {

  constructor({ pollInterval } = { pollInterval: 1000}) {
    super();
    this.pollInterval = pollInterval;
  }

  private _intervalId: NodeJS.Timer;
  private pollInterval: number;

  start() {
    // check if not already started
    if (this._intervalId) return;

    this._intervalId = setInterval(() => {
      this.emit('report', this.getReportData());
    }, this.pollInterval)
  }

  stop() {
    if (this._intervalId) clearInterval(this._intervalId);
    this._intervalId = null;
  }

  getReportData() {
    const processMetric = app.getAppMetrics();

    const allWebContents = webContents.getAllWebContents();
    const webContentsInfo = allWebContents.map((wc: overridenWebContents) => ({
      type: wc.getType(),
      id: wc.id,
      pid: wc.getOSProcessId(),
      URL: wc.getURL(),
      URLDomain: extractURLDomain(wc.getURL())
    }));

    return processMetric.map(proc => {
      const report = proc as ProcessMetricReport;
      
      const wc = webContentsInfo.find(wc => wc.pid === proc.pid);
      if (!wc) return report;

      report.webContents = [];
      report.webContents.push(wc);

      return report
    });
  }

}

export default ProcessStatsReporter;


