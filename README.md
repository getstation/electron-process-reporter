# electron-process-reporter

Utility to extract interesting process reports of an Electron application.

## Installation 

```bash
$ npm install electron-process-reporter
```

## Usage

```js
import { app } from 'electron';
import { onProcessMetricReport } from 'electron-process-reporter';

onProcessMetricReport(app) // returns a rx.Observable
  .subscribe(report => console.log(report))
```
