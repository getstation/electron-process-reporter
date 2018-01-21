import { Observable } from 'rxjs';
import { webContents } from 'electron';

import extractURLDomain from './extractURLDomain';

interface overridenWebContents extends webContents {
  getType(): string
}


export const onAppMetrics = (app: Electron.App, period = 1000) => 
  Observable
    .timer(0, period)
    .map(() => app.getAppMetrics());
    


export interface ProcessMetricReport extends Electron.ProcessMetric {
  webContents: {
    type: string,
    id: number,
    pid: number,
    URL: string,
    URLDomain: string
  }[]
}

export const onProcessMetricReport = (app: Electron.App, period = 1000) =>
  onAppMetrics(app, period)
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
        const report = proc as ProcessMetricReport;

        const wc = webContentsInfo.find(wc => wc.pid === proc.pid);
        if (!wc) return report;

        report.webContents = [];
        report.webContents.push(wc);

        return report
    })
  });
