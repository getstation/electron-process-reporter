import * as assert from 'assert';
import * as path from 'path';
import { Application } from 'spectron';

let electronPath = path.resolve(__dirname, '..', 'node_modules', '.bin', 'electron');
if (process.platform === 'win32') electronPath += '.cmd';

describe('Application launch', function() {
  this.timeout(10000);
  let app: Application;

  beforeEach(() => {
    app = new Application({
      path: electronPath,
      // args: [__dirname],
    });
    return app.start();
  });

  afterEach(() => {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  it('shows an initial window', function() {
    return app.client.getWindowCount().then((count: number) => {
      assert.equal(count, 1);
    });
  });
});
