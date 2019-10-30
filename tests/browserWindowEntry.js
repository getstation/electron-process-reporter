const { app, BrowserWindow } = require('electron');

app.on('ready', () => {
  const w = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
    },
  });
  w.loadURL('about:blank');
});
