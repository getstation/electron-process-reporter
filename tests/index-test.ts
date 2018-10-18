import { expect } from 'chai';
import * as path from 'path';
import { Application } from 'spectron';
import { getAppUsage } from '../src';

let electronPath = path.resolve(__dirname, '..', 'node_modules', '.bin', 'electron');
if (process.platform === 'win32') electronPath += '.cmd';

describe('Application launch', function() {
  this.timeout(10000);
  let app = new Application({
    path: electronPath,
  });

  this.beforeAll(() => {
    return app.start();
  });

  this.afterAll(() => {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  it('ensures that extracted pids are the same as those of getAppMetrics', async () => {
    const metrics = await app.electron.remote.app.getAppMetrics();
    const electronPids = metrics.map(m => m.pid);
    // Spectron TS definition is 🤢
    const mainPid: number = await (app.mainProcess.pid as any)();
    return getAppUsage(mainPid).then(pidusages => {
      const pids = pidusages.map(m => m.pid);
      expect(pids.sort()).to.deep.equal(electronPids.sort());
    });
  });
});
