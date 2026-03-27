// lib/function.js - AI Function Handlers
// Fungsi-fungsi yang bisa dipanggil oleh AI

const fs = require("fs")
const path = require("path")
const https = require("https")
const http = require("http")
const { exec } = require("child_process")

class AIFunctions {
  constructor(ctx, db) {
    this.ctx = ctx
    this.db = db
    this.tempDir = path.join(__dirname, "..", "temp")
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir)
    }
  }

  async sendVideoByUrl(url, caption = "") {
    try {
      const filePath = await this.downloadFile(url)
      
      if (filePath.error) {
        return { success: false, error: filePath.error }
      }

      await this.ctx.sendVideo(
        { source: filePath },
        { caption: caption || "🎬 Video" }
      )

      fs.unlinkSync(filePath)
      return { success: true, message: "Video terkirim" }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async sendPhotoByUrl(url, caption = "") {
    try {
      const filePath = await this.downloadFile(url)
      
      if (filePath.error) {
        return { success: false, error: filePath.error }
      }

      await this.ctx.sendPhoto(
        { source: filePath },
        { caption: caption || "📷 Foto" }
      )

      fs.unlinkSync(filePath)
      return { success: true, message: "Foto terkirim" }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async sendFileByUrl(url, caption = "") {
    try {
      const filePath = await this.downloadFile(url)
      
      if (filePath.error) {
        return { success: false, error: filePath.error }
      }

      await this.ctx.sendDocument(
        { source: filePath },
        { caption: caption || "📄 File" }
      )

      fs.unlinkSync(filePath)
      return { success: true, message: "File terkirim" }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async deleteFileByPath(filePath) {
    try {
      const safePath = this.getSafePath(filePath)
      
      if (!safePath.safe) {
        return { success: false, error: safePath.reason }
      }

      fs.unlinkSync(safePath.path)
      return { success: true, message: `File ${filePath} berhasil dihapus` }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async writeFileByPath(filePath, content) {
    try {
      const safePath = this.getSafePath(filePath)
      
      if (!safePath.safe) {
        return { success: false, error: safePath.reason }
      }

      fs.writeFileSync(safePath.path, content, "utf8")
      return { success: true, message: `File ${filePath} berhasil ditulis`, size: content.length }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async readFileByPath(filePath) {
    try {
      const safePath = this.getSafePath(filePath)
      
      if (!safePath.safe) {
        return { success: false, error: safePath.reason }
      }

      const content = fs.readFileSync(safePath.path, "utf8")
      return { success: true, content: content, size: content.length }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async listDirectory(dirPath = ".") {
    try {
      const safePath = this.getSafePath(dirPath)
      
      if (!safePath.safe) {
        return { success: false, error: safePath.reason }
      }

      const files = fs.readdirSync(safePath.path, { withFileTypes: true })
      const fileList = files.map(f => ({
        name: f.name,
        type: f.isDirectory() ? "directory" : "file"
      }))

      return { success: true, files: fileList, count: fileList.length }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async executeCommand(command) {
    const allowedCommands = [
      "date", "whoami", "pwd", "ls", "uname", "uptime",
      "df", "free", "ps", "ping", "du", "wc", "head", "tail",
      "cat", "grep", "find", "stat", "file", "mkdir", "touch", "cp", "mv", "rm",
      "echo", "clear", "hostname", "id", "w", "top", "node", "npm"
    ]

    const cmd = command.split(" ")[0].toLowerCase()
    
    if (!allowedCommands.includes(cmd)) {
      return { 
        success: false, 
        error: `Command "${cmd}" tidak diizinkan` 
      }
    }

    return new Promise((resolve) => {
      exec(command, { 
        timeout: 15000, 
        maxBuffer: 1024 * 1024 
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            output: null
          })
        } else {
          resolve({
            success: true,
            command: command,
            output: stdout || stderr || "(tidak ada output)"
          })
        }
      })
    })
  }

  async runJavaScript(code) {
    // Write code to temp file and execute
    const tempFile = path.join(this.tempDir, `script_${Date.now()}.js`)
    
    return new Promise((resolve) => {
      fs.writeFileSync(tempFile, code, "utf8")
      
      exec(`node "${tempFile}"`, { 
        timeout: 30000, 
        maxBuffer: 1024 * 1024 
      }, (error, stdout, stderr) => {
        // Clean up temp file
        fs.unlinkSync(tempFile)
        
        if (error) {
          resolve({
            success: false,
            error: error.message,
            output: null
          })
        } else {
          resolve({
            success: true,
            output: stdout || stderr || "(tidak ada output)"
          })
        }
      })
    })
  }

  async downloadFile(url) {
    return new Promise((resolve) => {
      const tempFile = path.join(this.tempDir, `download_${Date.now()}`)
      
      const client = url.startsWith("https") ? https : http
      
      client.get(url, (res) => {
        const file = fs.createWriteStream(tempFile)
        res.pipe(file)
        
        file.on("finish", () => {
          file.close()
          resolve(tempFile)
        })
      }).on("error", (err) => {
        fs.unlink(tempFile, () => {})
        resolve({ error: err.message })
      })
    })
  }

  getSafePath(inputPath) {
    try {
      const resolved = path.resolve(inputPath)
      const cwd = process.cwd()
      
      if (!resolved.startsWith(cwd)) {
        return { safe: false, reason: "Path di luar direktori yang diizinkan" }
      }

      if (resolved.includes("..")) {
        return { safe: false, reason: "Path traversal terdeteksi" }
      }

      return { safe: true, path: resolved }
    } catch (e) {
      return { safe: false, reason: `Invalid path: ${e.message}` }
    }
  }

  getAvailableFunctions() {
    return [
      { name: "sendVideoByUrl", description: "Kirim video dari URL" },
      { name: "sendPhotoByUrl", description: "Kirim foto dari URL" },
      { name: "sendFileByUrl", description: "Kirim file dari URL" },
      { name: "deleteFileByPath", description: "Hapus file" },
      { name: "writeFileByPath", description: "Tulis file" },
      { name: "readFileByPath", description: "Baca file" },
      { name: "listDirectory", description: "List folder" },
      { name: "executeCommand", description: "Execute shell command" },
      { name: "runJavaScript", description: "Execute JavaScript code" }
    ]
  }
}

module.exports = AIFunctions
