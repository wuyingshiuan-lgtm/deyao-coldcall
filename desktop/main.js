const { app, BrowserWindow, shell } = require('electron');

const APP_URL = 'https://wuyingshiuan-lgtm.github.io/deyao-coldcall/?v=5';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    autoHideMenuBar: true,
    title: '德曜精密業務電訪記錄',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL(APP_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
