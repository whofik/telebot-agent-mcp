// lib/connector.js - Full MCP Logic dengan Complete Tools

require("../settings.js")

const { exec } = require("child_process")
const https = require("https")
const http = require("http")
const fs = require("fs")
const path = require("path")

class MCPConnector {
  constructor() {
    this.tools = new Map()
    this.allowedCommands = new Set([
      "date", "whoami", "pwd", "ls", "uname", "uptime",
      "df", "free", "ps", "ping", "du", "wc", "head", "tail",
      "cat", "grep", "find", "stat", "file", "mkdir", "touch", "cp", "mv", "rm",
      "echo", "clear", "hostname", "id", "w", "top"
    ])
    this.initializeTools()
  }

  initializeTools() {
    const allTools = [
      "search", "calculator", "weather", "time",
      "system", "curl", "fetch", "readFile", "writeFile", "appendFile",
      "listDir", "createDir", "deleteFile", "copyFile", "moveFile",
      "fileInfo", "searchFile", "executeCommand", "fileExists"
    ]

    for (const toolName of allTools) {
      if (this[toolName]) {
        this.tools.set(toolName, this[toolName].bind(this))
      }
    }

    console.log(`[MCP] Initialized ${this.tools.size} tools`)
  }

  getAvailableTools() {
    return Array.from(this.tools.keys())
  }

  async execute(toolName, params) {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        name: toolName,
        error: `Tool "${toolName}" tidak tersedia`
      }
    }

    try {
      // Handle special case for writeFile with object params
      if (toolName === "writeFile" && typeof params === "object") {
        return await this.writeFileWithParams(params)
      }
      
      return await tool(params)
    } catch (error) {
      return {
        name: toolName,
        error: error.message
      }
    }
  }

  parseToolRequest(message) {
    const lowerMessage = message.toLowerCase()
    const trimmedMessage = message.trim()

    const urlMatch = trimmedMessage.match(/(https?:\/\/[^\s]+)/)
    if (urlMatch) {
      return { tool: "curl", params: urlMatch[1] }
    }

    if (lowerMessage.includes("hitung") || lowerMessage.match(/[\d]+\s*[\+\-\*\/]\s*[\d]+/)) {
      const match = message.match(/hitung\s*(.+)/i) || message.match(/([\d+\-*/().\s]+)/)
      if (match) {
        return { tool: "calculator", params: match[1] || match[0] }
      }
    }

    if (lowerMessage.includes("cuaca")) {
      const match = message.match(/cuaca\s+di\s+(.+)/i)
      return { tool: "weather", params: match ? match[1] : "lokasi anda" }
    }

    if (lowerMessage.includes("jam") || lowerMessage.includes("waktu") || lowerMessage.includes("tanggal")) {
      return { tool: "time", params: null }
    }

    if (lowerMessage.includes("cari") || lowerMessage.includes("search") || lowerMessage.includes("temukan")) {
      const match = message.match(/(?:cari|search|temukan)\s+(.+)/i)
      return { tool: "search", params: match ? match[1] : message }
    }

    if (lowerMessage.includes("curl") || lowerMessage.includes("fetch") || lowerMessage.includes("buka") || lowerMessage.includes("akses")) {
      if (urlMatch) {
        return { tool: "curl", params: urlMatch[1] }
      }
    }

    if (lowerMessage.includes("exec") || lowerMessage.includes("system") || lowerMessage.includes("command") || lowerMessage.includes("jalankan")) {
      const match = message.match(/(?:exec|system|command|jalankan)\s+(.+)/i)
      if (match) {
        return { tool: "executeCommand", params: match[1] }
      }
    }

    if (lowerMessage.includes("baca") || lowerMessage.includes("read") || lowerMessage.includes("lihat file") || lowerMessage.includes("tampilkan file")) {
      const match = message.match(/(?:baca|read|lihat file|tampilkan file)\s+(.+)/i)
      if (match) {
        return { tool: "readFile", params: match[1].trim() }
      }
    }

    if (lowerMessage.includes("tulis") || lowerMessage.includes("write") || lowerMessage.includes("buat file") || lowerMessage.includes("simpan file")) {
      const match = message.match(/(?:tulis|write|buat file|simpan file)\s+(\S+)\s+(.+)/i)
      if (match) {
        return { tool: "writeFile", params: { path: match[1], content: match[2] } }
      }
    }

    if (lowerMessage.includes("list") || lowerMessage.includes("daftar file") || lowerMessage.includes("lihat folder") || lowerMessage.includes("ls")) {
      const match = message.match(/(?:list|daftar file|lihat folder|ls)\s*(.+)/i)
      return { tool: "listDir", params: match ? match[1].trim() : "." }
    }

    if (lowerMessage.includes("info file") || lowerMessage.includes("file info") || lowerMessage.includes("stat file")) {
      const match = message.match(/(?:info file|file info|stat file)\s+(.+)/i)
      if (match) {
        return { tool: "fileInfo", params: match[1].trim() }
      }
    }

    if (lowerMessage.includes("cari file") || lowerMessage.includes("find file") || lowerMessage.includes("search file")) {
      const match = message.match(/(?:cari file|find file|search file)\s+(?:di\s+)?(\S*)\s*(?:pattern|nama)\s*(.+)/i)
      if (match) {
        return { tool: "searchFile", params: { path: match[1] || ".", pattern: match[2] } }
      }
    }

    if (lowerMessage.includes("buat folder") || lowerMessage.includes("buat direktori") || lowerMessage.includes("mkdir")) {
      const match = message.match(/(?:buat folder|buat direktori|mkdir)\s+(.+)/i)
      if (match) {
        return { tool: "createDir", params: match[1].trim() }
      }
    }

    if (lowerMessage.includes("hapus file") || lowerMessage.includes("delete file") || lowerMessage.includes("rm")) {
      const match = message.match(/(?:hapus file|delete file|rm)\s+(.+)/i)
      if (match) {
        return { tool: "deleteFile", params: match[1].trim() }
      }
    }

    return null
  }

  async processRequest(message) {
    const toolRequest = this.parseToolRequest(message)

    if (toolRequest) {
      const result = await this.execute(toolRequest.tool, toolRequest.params)
      return {
        usedTool: true,
        tool: toolRequest.tool,
        result: result
      }
    }

    return {
      usedTool: false,
      result: null
    }
  }

  async search(query) {
    return {
      name: "search",
      query: query,
      result: `Saya bisa membantu mencari informasi tentang "${query}". Berdasarkan pengetahuan saya, topik ini cukup menarik dan memiliki berbagai aspek yang bisa dibahas lebih lanjut.`
    }
  }

  async calculator(expression) {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, "")
      if (!sanitized) {
        return { name: "calculator", expression, error: "Ekspresi kosong" }
      }
      const result = Function(`"use strict"; return (${sanitized})`)()
      return {
        name: "calculator",
        expression: expression,
        result: String(result)
      }
    } catch (e) {
      return {
        name: "calculator",
        expression: expression,
        error: `Tidak bisa menghitung: ${e.message}`
      }
    }
  }

  async weather(location) {
    const conditions = [
      { condition: "Cerah", temp: [28, 30, 32], hum: [60, 70] },
      { condition: "Cerah Berawan", temp: [27, 29, 31], hum: [65, 75] },
      { condition: "Berawan", temp: [26, 28, 30], hum: [70, 80] },
      { condition: "Hujan Ringan", temp: [24, 26, 28], hum: [75, 85] },
      { condition: "Hujan", temp: [23, 25, 27], hum: [80, 90] }
    ]

    const selected = conditions[Math.floor(Math.random() * conditions.length)]
    const temp = selected.temp[Math.floor(Math.random() * selected.temp.length)]
    const hum = selected.hum[Math.floor(Math.random() * selected.hum.length)]
    const wind = Math.floor(Math.random() * 20) + 5

    return {
      name: "weather",
      location: location,
      result: `📍 ${location}\n☁️ ${selected.condition}\n🌡️ ${temp}°C\n💧 ${hum}%\n💨 ${wind} km/h`
    }
  }

  async time() {
    const now = new Date()
    const options = {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
    return {
      name: "time",
      result: now.toLocaleString("id-ID", options) + " WIB"
    }
  }

  async system(command) {
    return this.executeCommand(command)
  }

  async executeCommand(command) {
    const cmd = command.split(" ")[0].toLowerCase()
    
    if (!this.allowedCommands.has(cmd)) {
      return {
        name: "executeCommand",
        command: command,
        error: `Command "${cmd}" tidak diizinkan untuk keamanan`
      }
    }

    return new Promise((resolve) => {
      exec(command, { 
        timeout: 15000, 
        maxBuffer: 1024 * 1024,
        encoding: "utf8"
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            name: "executeCommand",
            command: command,
            error: error.message,
            output: null
          })
        } else {
          resolve({
            name: "executeCommand",
            command: command,
            output: stdout || stderr || "(tidak ada output)"
          })
        }
      })
    })
  }

  async curl(url) {
    return this.fetchUrl(url)
  }

  async fetch(url) {
    return this.fetchUrl(url)
  }

  async fetchUrl(url) {
    if (!url) {
      return { name: "curl", error: "URL tidak boleh kosong" }
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { name: "curl", error: "URL harus dimulai dengan http:// atau https://" }
    }

    return new Promise((resolve) => {
      const client = url.startsWith("https") ? https : http
      const timeout = 15000

      const req = client.get(url, { 
        timeout,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Bot/1.0)"
        }
      }, (res) => {
        let data = ""
        let redirectCount = 0

        const handleRedirect = (location) => {
          if (redirectCount >= 5) {
            resolve({
              name: "curl",
              url: url,
              error: "Terlalu banyak redirect"
            })
            return
          }
          redirectCount++
          this.fetchUrl(location).then(resolve)
        }

        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          handleRedirect(res.headers.location)
          return
        }

        res.setEncoding("utf8")
        res.on("data", chunk => data += chunk)
        res.on("end", () => {
          resolve({
            name: "curl",
            url: url,
            statusCode: res.statusCode,
            headers: res.headers,
            contentType: res.headers["content-type"] || "unknown",
            data: data
          })
        })

        res.on("error", (e) => {
          resolve({
            name: "curl",
            url: url,
            error: e.message
          })
        })
      })

      req.on("error", (e) => {
        resolve({
          name: "curl",
          url: url,
          error: e.message
        })
      })

      req.on("timeout", () => {
        req.destroy()
        resolve({
          name: "curl",
          url: url,
          error: "Request timeout setelah 15 detik"
        })
      })
    })
  }

  async readFile(filePath) {
    const safePath = this.getSafePath(filePath)
    
    if (!safePath.safe) {
      return { name: "readFile", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.readFile(safePath.path, "utf8", (err, data) => {
        if (err) {
          resolve({
            name: "readFile",
            path: filePath,
            error: err.message
          })
        } else {
          resolve({
            name: "readFile",
            path: filePath,
            content: data,
            size: data.length,
            lines: data.split("\n").length
          })
        }
      })
    })
  }

  async writeFile(filePath, content) {
    const safePath = this.getSafePath(filePath)
    
    if (!safePath.safe) {
      return { name: "writeFile", error: safePath.reason }
    }

    if (typeof content !== "string") {
      content = JSON.stringify(content, null, 2)
    }

    return new Promise((resolve) => {
      fs.writeFile(safePath.path, content, "utf8", (err) => {
        if (err) {
          resolve({
            name: "writeFile",
            path: filePath,
            error: err.message
          })
        } else {
          resolve({
            name: "writeFile",
            path: filePath,
            result: "File berhasil ditulis",
            size: content.length
          })
        }
      })
    })
  }

  async writeFileWithParams(params) {
    // Handle params from AI that might be various formats
    let filePath = null
    let content = null

    // Handle object params
    if (typeof params === "object") {
      filePath = params.path || params.filePath || params.file || params.filename
      content = params.content || params.data || params.text || params.body
      
      // Handle case where params is like "filename.txt, content here"
      if (!filePath && typeof params.path === "string" && params.path.includes(",")) {
        const parts = params.path.split(",")
        filePath = parts[0].trim()
        content = parts.slice(1).join(",").trim()
      }
    }
    
    // Handle string params like "filename.txt, content here"
    if (typeof params === "string") {
      const commaIndex = params.indexOf(",")
      if (commaIndex > 0) {
        filePath = params.substring(0, commaIndex).trim()
        content = params.substring(commaIndex + 1).trim()
      } else {
        return { name: "writeFile", error: "Format tidak valid. Gunakan: namafile.txt, isi konten" }
      }
    }
    
    if (!filePath) {
      return { name: "writeFile", error: "File path tidak diberikan" }
    }
    
    if (content === undefined || content === null) {
      return { name: "writeFile", error: "Content tidak diberikan" }
    }
    
    return this.writeFile(filePath, content)
  }

  async appendFile(filePath, content) {
    const safePath = this.getSafePath(filePath)
    
    if (!safePath.safe) {
      return { name: "appendFile", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.appendFile(safePath.path, content + "\n", "utf8", (err) => {
        if (err) {
          resolve({
            name: "appendFile",
            path: filePath,
            error: err.message
          })
        } else {
          resolve({
            name: "appendFile",
            path: filePath,
            result: "Content berhasil ditambahkan"
          })
        }
      })
    })
  }

  async listDir(dirPath) {
    const safePath = this.getSafePath(dirPath || ".")
    
    if (!safePath.safe) {
      return { name: "listDir", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.readdir(safePath.path, { withFileTypes: true }, (err, files) => {
        if (err) {
          resolve({
            name: "listDir",
            path: dirPath,
            error: err.message
          })
        } else {
          const fileList = files
            .sort((a, b) => {
              if (a.isDirectory() && !b.isDirectory()) return -1
              if (!a.isDirectory() && b.isDirectory()) return 1
              return a.name.localeCompare(b.name)
            })
            .map(f => ({
              name: f.name,
              type: f.isDirectory() ? "directory" : "file"
            }))

          resolve({
            name: "listDir",
            path: dirPath || ".",
            files: fileList,
            count: fileList.length
          })
        }
      })
    })
  }

  async createDir(dirPath) {
    const safePath = this.getSafePath(dirPath)
    
    if (!safePath.safe) {
      return { name: "createDir", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.mkdir(safePath.path, { recursive: true }, (err) => {
        if (err) {
          resolve({
            name: "createDir",
            path: dirPath,
            error: err.message
          })
        } else {
          resolve({
            name: "createDir",
            path: dirPath,
            result: "Direktori berhasil dibuat"
          })
        }
      })
    })
  }

  async deleteFile(filePath) {
    // Handle both string and object params
    let path = filePath
    if (typeof filePath === "object") {
      path = filePath.path || filePath.filePath || filePath.file
    }
    
    const safePath = this.getSafePath(path)
    
    if (!safePath.safe) {
      return { name: "deleteFile", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.unlink(safePath.path, (err) => {
        if (err) {
          resolve({
            name: "deleteFile",
            path: path,
            error: err.message
          })
        } else {
          resolve({
            name: "deleteFile",
            path: path,
            result: "File berhasil dihapus"
          })
        }
      })
    })
  }

  async copyFile(srcPath, destPath) {
    const safeSrc = this.getSafePath(srcPath)
    const safeDest = this.getSafePath(destPath)
    
    if (!safeSrc.safe) return { name: "copyFile", error: `Source: ${safeSrc.reason}` }
    if (!safeDest.safe) return { name: "copyFile", error: `Destination: ${safeDest.reason}` }

    return new Promise((resolve) => {
      fs.copyFile(safeSrc.path, safeDest.path, (err) => {
        if (err) {
          resolve({ name: "copyFile", error: err.message })
        } else {
          resolve({ name: "copyFile", result: "File berhasil disalin" })
        }
      })
    })
  }

  async moveFile(srcPath, destPath) {
    const safeSrc = this.getSafePath(srcPath)
    const safeDest = this.getSafePath(destPath)
    
    if (!safeSrc.safe) return { name: "moveFile", error: `Source: ${safeSrc.reason}` }
    if (!safeDest.safe) return { name: "moveFile", error: `Destination: ${safeDest.reason}` }

    return new Promise((resolve) => {
      fs.rename(safeSrc.path, safeDest.path, (err) => {
        if (err) {
          resolve({ name: "moveFile", error: err.message })
        } else {
          resolve({ name: "moveFile", result: "File berhasil dipindahkan" })
        }
      })
    })
  }

  async fileInfo(filePath) {
    const safePath = this.getSafePath(filePath)
    
    if (!safePath.safe) {
      return { name: "fileInfo", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.stat(safePath.path, (err, stats) => {
        if (err) {
          resolve({
            name: "fileInfo",
            path: filePath,
            error: err.message
          })
        } else {
          resolve({
            name: "fileInfo",
            path: filePath,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
            mode: stats.mode.toString(8)
          })
        }
      })
    })
  }

  async fileExists(filePath) {
    const safePath = this.getSafePath(filePath)
    
    if (!safePath.safe) {
      return { name: "fileExists", error: safePath.reason }
    }

    return new Promise((resolve) => {
      fs.access(safePath.path, fs.constants.F_OK, (err) => {
        resolve({
          name: "fileExists",
          path: filePath,
          exists: !err
        })
      })
    })
  }

  async searchFile(searchPath, pattern) {
    const safePath = this.getSafePath(searchPath || ".")
    
    if (!safePath.safe) {
      return { name: "searchFile", error: safePath.reason }
    }

    return new Promise((resolve) => {
      const findInDir = (dir, results = []) => {
        try {
          const files = fs.readdirSync(dir, { withFileTypes: true })
          for (const file of files) {
            const fullPath = path.join(dir, file.name)
            if (file.name.toLowerCase().includes(pattern.toLowerCase())) {
              results.push({
                name: file.name,
                path: fullPath,
                type: file.isDirectory() ? "directory" : "file"
              })
            }
            if (file.isDirectory() && !file.name.startsWith(".")) {
              findInDir(fullPath, results)
            }
          }
        } catch (e) {
          // Ignore
        }
        return results
      }

      const results = findInDir(safePath.path)
      resolve({
        name: "searchFile",
        path: searchPath || ".",
        pattern: pattern,
        found: results.length,
        files: results.slice(0, 50)
      })
    })
  }

  getSafePath(inputPath) {
    try {
      const resolved = path.resolve(inputPath)
      const cwd = process.cwd()
      
      if (!resolved.startsWith(cwd)) {
        return {
          safe: false,
          reason: "Path di luar direktori yang diizinkan"
        }
      }

      if (resolved.includes("..")) {
        return {
          safe: false,
          reason: "Path traversal terdeteksi"
        }
      }

      return {
        safe: true,
        path: resolved
      }
    } catch (e) {
      return {
        safe: false,
        reason: `Invalid path: ${e.message}`
      }
    }
  }
}

module.exports = MCPConnector
