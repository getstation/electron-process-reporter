# electron-process-reporter
Utility to extract interesting process reports of an Electron application.

## Installation 
```bash
$ npm install --save electron-process-reporter
```

## Usage

### onExtendedProcessMetrics
Returns an Rx.Observable that emits reports of `ExtendedProcessMetric` every `options.samplingInterval` ms.
```js
import { app } from 'electron';
import { onExtendedProcessMetrics } from 'electron-process-reporter';

onExtendedProcessMetrics(app, { samplingInterval: 1000 }) // returns a rx.Observable
  .subscribe(report => console.log(report))
```

### onExcessiveCPUUsage
Will emit `ExtendedProcessMetric[]` when a process exceeds the `options.percentCPUUsageThreshold` on more than `options.samplesCount` samples.
```js
import { app } from 'electron';
import { onExcessiveCPUUsage } from 'electron-process-reporter';

onExcessiveCPUUsage(
  app,
  {
    samplesCount: 1,
    percentCPUUsageThreshold: 90,
  }) // returns a rx.Observable
  .subscribe(report => console.log(report))
```

### onProcessTreeMetricsForPid
Returns an Rx.Observable that emits `PidUsage[]` every `options.samplingInterval` ms.
```js
import { onProcessTreeMetricsForPid } from 'electron-process-reporter';

onProcessTreeMetricsForPid(process.pid, { samplingInterval: 1000 }) // returns a rx.Observable
  .subscribe(report => console.log(report))
```

### onExcessiveCPUUsageInProcessTree
Will emit `PidUsage[]` when a process of the tree exceeds the `options.percentCPUUsageThreshold` on more than `options.samplesCount` samples.
```js
import { onExcessiveCPUUsageInProcessTree } from 'electron-process-reporter';

onExcessiveCPUUsageInProcessTree(
  process.pid, // in the main process
  {
    samplesCount: 1,
    percentCPUUsageThreshold: 90,
  }) // returns a rx.Observable
  .subscribe(report => console.log(report))
```
