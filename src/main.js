const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const PET_WIDTH = 260;
const PET_HEIGHT = 300;
let petWindow;
let dragOffset = null;

function getInitialBounds() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  return {
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: Math.round(workArea.x + workArea.width - PET_WIDTH - 36),
    y: Math.round(workArea.y + workArea.height - PET_HEIGHT - 28)
  };
}

function createPetWindow() {
  const bounds = getInitialBounds();

  petWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createPetWindow);

if (process.env.MIMI_SMOKE_TEST === '1') {
  app.whenReady().then(() => {
    setTimeout(() => app.quit(), 3000);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPetWindow();
  }
});

ipcMain.handle('pet:start-drag', () => {
  if (!petWindow) return;

  const cursor = screen.getCursorScreenPoint();
  const [windowX, windowY] = petWindow.getPosition();
  dragOffset = {
    x: cursor.x - windowX,
    y: cursor.y - windowY
  };
});

ipcMain.handle('pet:drag', () => {
  if (!petWindow || !dragOffset) return;

  const cursor = screen.getCursorScreenPoint();
  petWindow.setPosition(
    Math.round(cursor.x - dragOffset.x),
    Math.round(cursor.y - dragOffset.y),
    false
  );
});

ipcMain.handle('pet:end-drag', () => {
  dragOffset = null;
});

ipcMain.handle('pet:close', () => {
  app.quit();
});
