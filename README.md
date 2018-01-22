# electron-process-reporter

Utility to extract interesting process reports of an Electron application.

## Installation 

```bash
$ npm install electron-process-reporter
```

## Usage

```js
import { app } from 'electron';
import { onExtendedProcessMetrics } from 'electron-process-reporter';

onExtendedProcessMetrics(app) // returns a rx.Observable
  .subscribe(report => console.log(report))
```
