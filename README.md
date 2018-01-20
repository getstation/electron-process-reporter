# electron-process-reporter

Utility to extract interesting process reports of an Electron application.

## Installation 

```bash
$ npm install electron-process-reporter
```

## Usage

```js
import { ProcessStatsReporter } from electron-process-reporter;

const reporter = new ProcessStatsReporter();
reporter.on('report', report => {
  console.log(report)
});
// will start polling and emits a report
report.start();
```
