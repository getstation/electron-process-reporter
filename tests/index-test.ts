import { expect } from 'chai';
import { Application } from 'spectron';
import { getAppUsage } from '../src';
import { resolve } from 'path';

describe('Application launch', function() {
  this.timeout(10000);
  let app: Application;

  this.beforeAll(async () => {
    app = new Application({
      path: require('electron') as any,
      args: [resolve(__dirname, 'browserWindowEntry.js')],
    });

    await app.start();
    return app.client.waitUntilWindowLoaded();
  });

  this.afterAll(() => {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  it('ensures that extracted pids are the same as those of getAppMetrics', async () => {
    const metrics = await app.electron.remote.app.getAppMetrics();
    const electronPids = new Set(metrics.map(m => m.pid));
    // Spectron TS definition is 🤢
    const mainPid: number = await (app.mainProcess.pid as any)();
    return getAppUsage(mainPid).then(pidusages => {
      const pids = new Set(pidusages.map(m => m.pid));
      // Linux and windows can have zygote process
      // which does not appear in getAppMetrics
      // but which are part of process tree.
      const zygotePids = [...pids].filter(x => !electronPids.has(x));
      expect(zygotePids).to.have.lengthOf.at.most(1);
      if (zygotePids.length === 1) {
        // zygote process here
        expect(pidusages.find(pu => pu.pid === zygotePids[0]))
          .to.have.property('ppid')
          .to.equal(mainPid);
        const pidsWithoutZygote = new Set([...pids]);
        pidsWithoutZygote.delete(zygotePids[0]);
        expect(pidsWithoutZygote).to.deep.equal(electronPids);
      } else {
        // no zygote process
        expect(pids).to.deep.equal(electronPids);
      }
    });
  });
});
