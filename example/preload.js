console.log('PRELOAD');

if (process.env.TEST_PROCESS_REPORTER) {
  console.log('NODE_ENV TEST');
  window.electronRequire = require;
}
