// Cầu nối cho trang web trong app desktop (contextIsolation + sandbox nên phải là CommonJS).
// Trang Cài đặt dùng window.shadowingDesktop để hiện phiên bản và cập nhật khi người dùng bấm.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shadowingDesktop', {
  updater: {
    getState: () => ipcRenderer.invoke('updater:get'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    openRelease: () => ipcRenderer.invoke('updater:open-release'),
    /** trả về hàm huỷ đăng ký */
    onState: (callback) => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('updater:state', listener)
      return () => ipcRenderer.removeListener('updater:state', listener)
    },
  },
})
