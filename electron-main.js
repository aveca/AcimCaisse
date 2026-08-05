const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  win.loadFile('index-electron.html');

  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('Load failed:', code, desc);
  });

  win.webContents.on('console-message', (e, level, msg) => {
    if (level >= 2) console.error('CONSOLE:', msg);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});