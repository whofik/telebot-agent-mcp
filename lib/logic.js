// lib/logic.js - Full AI Logic dengan Function Calling

require("../settings.js")

const https = require("https")
const http = require("http")
const AIFunctions = require("./function.js")

class GeminiLogic {
  constructor() {
    this.platform = global.platfrom || "gemini"
    this.sessions = new Map()
    
    if (this.platform === "gemini") {
      try {
        const { GoogleGenAI } = require("@google/genai")
        this.ai = new GoogleGenAI({ apiKey: global.gemini.apikey })
        this.model = global.gemini.model
        console.log(`[AI] ✓ Gemini initialized: ${this.model}`)
      } catch (e) {
        console.error(`[AI] ✗ Gemini init error: ${e.message}`)
        this.ai = null
        this.model = global.gemini.model
      }
    } else {
      this.ai = null
      this.model = global.openrouter_config.model
      console.log(`[AI] ✓ OpenRouter initialized: ${this.model}`)
    }
  }

  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        history: [],
        createdAt: Date.now(),
        lastActive: Date.now()
      })
    }

    const session = this.sessions.get(userId)
    session.lastActive = Date.now()
    return session
  }

  async resetSession(userId) {
    this.sessions.delete(userId)
    return true
  }

  addToHistory(userId, role, content) {
    const session = this.getSession(userId)
    session.history.push({
      role: role,
      parts: [{ text: content }]
    })

    if (session.history.length > global.session.maxHistory) {
      session.history = session.history.slice(-global.session.maxHistory)
    }
  }

  clearExpiredSessions() {
    const now = Date.now()
    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.lastActive > global.session.ttl) {
        this.sessions.delete(userId)
      }
    }
  }

  getFunctionsDescription() {
    return `
KAMU PUNYA AKSES KE FUNGSI-FUNGSI BERIKUT:

1 sendVideoByUrl(url caption) - Kirim video dari URL ke Telegram
   Contoh: sendVideoByUrl("https://example.com/video.mp4" "Video keren nih")

2 sendPhotoByUrl(url caption) - Kirim foto dari URL ke Telegram
   Contoh: sendPhotoByUrl("https://example.com/photo.jpg" "Foto bagus")

3 sendFileByUrl(url caption) - Kirim file dari URL ke Telegram
   Contoh: sendFileByUrl("https://example.com/file.pdf" "Dokumen penting")

4 deleteFileByPath(path) - Hapus file dari filesystem
   Contoh: deleteFileByPath("test.txt")

5 writeFileByPath(path content) - Tulis file
   Contoh: writeFileByPath("catatan.txt" "Isi catatan")

6 readFileByPath(path) - Baca file
   Contoh: readFileByPath("config.json")

7 listDirectory(path) - List isi folder
   Contoh: listDirectory(".")

8 executeCommand(command) - Execute shell command sederhana
   Contoh: executeCommand("ls -la") executeCommand("pwd")
   Hanya untuk command sederhana bukan JavaScript kompleks

9 runJavaScript(code) - Execute JavaScript code Node.js
   Contoh: runJavaScript("console.log('hello');")
   PAKAI INI UNTUK KODE JAVASCRIPT KOMPLEKS!
   Tulis seluruh kode dalam satu string parameter

PENTING:
- Untuk kode JavaScript kompleks LANGSUNG pakai runJavaScript bukan executeCommand
- runJavaScript akan save kode ke temp file dan execute dengan node
- Jangan pakai executeCommand untuk JavaScript - akan gagal!

CARA MENGGUNAKAN:
- Tulis nama fungsi di response kamu seperti ini: [CALL: functionName("param1" "param2")]
- Kamu bisa call multiple functions
- Functions akan dieksekusi otomatis setelah response kamu
`
  }

  async understandIntent(message, availableTools) {
    const toolsList = availableTools.join(", ")

    const prompt = `Kamu adalah AI assistant yang cerdas Tugasmu memahami maksud user

TOOLS TERSEDIA: ${toolsList}

PESAN USER: "${message}"

ANALISIS:
1 Apa yang user inginkan
2 Perlu tool atau tidak
3 Tool apa dan parameternya

RESPONSE FORMAT JSON saja:
{
  "intent": "deskripsi singkat"
  "needsTools": true/false
  "tools": [
    {"name": "nama_tool" "params": "parameter" "reason": "alasan"}
  ]
}`

    try {
      const response = await this.generateContent(prompt)
      const text = response.text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      return { intent: "unknown", needsTools: false, tools: [] }
    } catch (error) {
      console.error("Intent analysis error:", error.message)
      return { intent: "error", needsTools: false, tools: [] }
    }
  }

  async executeTools(toolPlans, mcpConnector) {
    const results = []

    for (const toolPlan of toolPlans) {
      try {
        console.log(`  → Executing: ${toolPlan.name}(${JSON.stringify(toolPlan.params)})`)
        
        const result = await mcpConnector.execute(toolPlan.name, toolPlan.params)
        
        results.push({
          tool: toolPlan.name,
          params: toolPlan.params,
          reason: toolPlan.reason,
          result: result,
          success: !result.error,
          error: result.error || null
        })
      } catch (error) {
        results.push({
          tool: toolPlan.name,
          params: toolPlan.params,
          reason: toolPlan.reason,
          result: null,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  parseFunctionCalls(text) {
    const calls = []
    const regex = /\[CALL:\s*(\w+)\(([^)]*)\)\]/g
    let match

    while ((match = regex.exec(text)) !== null) {
      const functionName = match[1]
      const paramsStr = match[2]
      
      // Parse parameters
      const params = []
      const paramRegex = /"([^"]*)"/g
      let paramMatch
      
      while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
        params.push(paramMatch[1])
      }

      calls.push({
        function: functionName,
        params: params
      })
    }

    return calls
  }

  async executeFunctionCalls(calls, aiFunctions) {
    const results = []

    for (const call of calls) {
      console.log(`[Function Call] ${call.function}(${call.params.join(", ")})`)

      const fn = aiFunctions[call.function]
      if (!fn) {
        results.push({
          function: call.function,
          success: false,
          error: `Function "${call.function}" not found`
        })
        continue
      }

      try {
        const result = await fn(...call.params)
        results.push({
          function: call.function,
          success: result.success,
          result: result,
          error: result.error || null
        })
      } catch (error) {
        results.push({
          function: call.function,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  formatRawData(tool, data) {
    if (!data) return "No data"
    if (data.error) return `Error: ${data.error}`

    switch(tool) {
      case "calculator":
        return `${data.result}`
      case "weather":
        return data.result
      case "time":
        return data.result
      case "curl":
      case "fetch":
        if (data.contentType?.includes("application/json")) {
          try {
            const parsed = JSON.parse(data.data)
            return JSON.stringify(parsed, null, 2)
          } catch {
            return data.data
          }
        }
        return data.data.substring(0, 3000)
      case "readFile":
        return data.content
      case "writeFile":
        return data.result || "File written"
      case "listDir":
        return data.files.map(f => `${f.type === "directory" ? "📁" : "📄"} ${f.name}`).join("\n")
      case "executeCommand":
      case "system":
        return data.output
      default:
        return JSON.stringify(data, null, 2)
    }
  }

  async createNaturalResponse(userId, message, intent, toolResults = []) {
    const session = this.getSession(userId)

    let context = ""

    if (toolResults.length > 0) {
      context = "=== DATA HASIL TOOL ===\n"
      toolResults.forEach((r, i) => {
        context += `\n[Tool ${i + 1}: ${r.tool}]\n`
        if (r.success) {
          context += `Berhasil!\nData: ${this.formatRawData(r.tool, r.result)}\n`
        } else {
          context += `Gagal: ${r.error}\n`
        }
      })
      context += "\n=====================\n\n"
    }

    const conversationHistory = session.history.slice(-6).map(h => 
      `${h.role === "user" ? "User" : "Assistant"}: ${h.parts[0].text.substring(0, 200)}`
    ).join("\n")

    const functionsDesc = this.getFunctionsDescription()

    const prompt = `${context}${functionsDesc}

RIWAYAT PERCAKAPAN:
${conversationHistory || "(percakapan baru)"}

PESAN TERAKHIR USER: "${message}"

INTENT: ${intent?.intent || "unknown"}

GAYA CHAT KAMU:
- Santai casual seperti teman ngobrol
- Pakai emoji secukupnya
- Pakai kata "nih" "loh" "dong" biar natural
- Jangan kaku seperti robot

YANG HARUS DILAKUKAN:
1 Kalau ada hasil tool jelaskan dengan kata-kata sendiri
2 Kalau user kasih kode JavaScript KOMPLEKS langsung call runJavaScript
3 Kalau ada video/foto dari API dan user mau download call sendVideoByUrl atau sendPhotoByUrl
4 Tulis function call seperti ini: [CALL: sendVideoByUrl("url" "caption")]
5 Function akan dieksekusi otomatis setelah response kamu

CONTOH RESPONSE:
- "Oke udah saya curl API nya Dapet video TikTok nih Saya kirim ya [CALL: sendVideoByUrl("https://example.com/video.mp4" "Video TikTok dari API")]"
- "Wah berhasil File nya udah saya hapus [CALL: deleteFileByPath("test.txt")]"
- "Siap saya jalanin kode JavaScript nya [CALL: runJavaScript("console.log('hello');")]"
- "Oke saya execute command nya [CALL: executeCommand("ls -la")]"

JANGAN:
- Jangan pakai executeCommand untuk JavaScript kompleks - pakai runJavaScript!
- Jangan tanya konfirmasi berlebihan - langsung action

Sekarang jawab dengan natural dan call function kalau perlu:`

    const contents = []

    contents.push({
      role: "user",
      parts: [{ text: "Kamu adalah teman chat yang asik Jawab dengan natural santai friendly dalam bahasa Indonesia" }]
    })
    contents.push({
      role: "model",
      parts: [{ text: "Siap Saya akan ngobrol santai kayak teman sendiri" }]
    })

    for (const msg of session.history.slice(-10)) {
      contents.push(msg)
    }

    contents.push({
      role: "user",
      parts: [{ text: prompt }]
    })

    try {
      const response = await this.generateContentFromMessages(contents)

      let text = response.text

      // Cleanup markdown
      text = text.replace(/\*\*(.*?)\*\*/g, "$1")
      text = text.replace(/\*(.*?)\*/g, "$1")
      text = text.replace(/`{1,3}(.*?)`{1,3}/g, "$1")
      text = text.replace(/^\s*[-*+]\s*/gm, "")
      text = text.replace(/^\s*\d+\.\s*/gm, "")
      text = text.trim()

      return {
        success: true,
        text: text,
        model: this.model
      }
    } catch (error) {
      console.error("Response generation error:", error.message)
      return {
        success: false,
        error: error.message,
        text: "Wah ada error nih coba lagi yuk"
      }
    }
  }

  async generateContentGemini(prompt) {
    if (!this.ai) {
      throw new Error("Gemini AI not initialized")
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })

    return { text: response.text }
  }

  async generateContentFromMessagesGemini(messages) {
    if (!this.ai) {
      throw new Error("Gemini AI not initialized")
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: messages
    })

    return { text: response.text }
  }

  async generateContentOpenRouter(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: global.openrouter_config.temperature,
        max_tokens: global.openrouter_config.max_tokens
      })

      const options = {
        hostname: "openrouter.ai",
        port: 443,
        path: "/api/v1/chat/completions",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${global.openrouter.apikey}`,
          "Content-Type": "application/json"
        }
      }

      const req = https.request(options, (res) => {
        let responseData = ""

        res.on("data", chunk => responseData += chunk)
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`OpenRouter API Error: ${res.statusCode} - ${responseData}`))
            return
          }

          try {
            const parsed = JSON.parse(responseData)
            resolve({ text: parsed.choices?.[0]?.message?.content || "" })
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`))
          }
        })
      })

      req.on("error", reject)
      req.write(data)
      req.end()
    })
  }

  async generateContentFromMessagesOpenRouter(messages) {
    return new Promise((resolve, reject) => {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.parts ? msg.parts[0].text : msg.content
      }))

      const data = JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        temperature: global.openrouter_config.temperature,
        max_tokens: global.openrouter_config.max_tokens
      })

      const options = {
        hostname: "openrouter.ai",
        port: 443,
        path: "/api/v1/chat/completions",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${global.openrouter.apikey}`,
          "Content-Type": "application/json"
        }
      }

      const req = https.request(options, (res) => {
        let responseData = ""

        res.on("data", chunk => responseData += chunk)
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`OpenRouter API Error: ${res.statusCode} - ${responseData}`))
            return
          }

          try {
            const parsed = JSON.parse(responseData)
            resolve({ text: parsed.choices?.[0]?.message?.content || "" })
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`))
          }
        })
      })

      req.on("error", reject)
      req.write(data)
      req.end()
    })
  }

  async generateContent(prompt) {
    if (this.platform === "gemini") {
      return await this.generateContentGemini(prompt)
    } else {
      return await this.generateContentOpenRouter(prompt)
    }
  }

  async generateContentFromMessages(messages) {
    if (this.platform === "gemini") {
      return await this.generateContentFromMessagesGemini(messages)
    } else {
      return await this.generateContentFromMessagesOpenRouter(messages)
    }
  }

  async processWithAI(userId, message, mcpConnector, aiFunctions) {
    console.log(`\n[AI] Processing: "${message.substring(0, 50)}..."`)
    console.log(`[AI] Platform: ${this.platform} | Model: ${this.model}`)

    const availableTools = mcpConnector.getAvailableTools()
    console.log(`[AI] Available tools: ${availableTools.join(", ")}`)

    console.log(`[AI] Step 1: Understanding intent...`)
    const intent = await this.understandIntent(message, availableTools)
    console.log(`[AI] Intent: ${intent.intent}`)
    console.log(`[AI] Needs tools: ${intent.needsTools}`)

    let toolResults = []

    if (intent.needsTools && intent.tools && intent.tools.length > 0) {
      console.log(`[AI] Step 2: Executing tools...`)
      toolResults = await this.executeTools(intent.tools, mcpConnector)
      console.log(`[AI] Tools execution complete Success: ${toolResults.filter(t => t.success).length}/${toolResults.length}`)
    }

    console.log(`[AI] Step 3: Creating natural response...`)
    const response = await this.createNaturalResponse(userId, message, intent, toolResults)

    console.log(`[AI] Step 4: Checking function calls...`)
    const functionCalls = this.parseFunctionCalls(response.text)
    
    let functionResults = []
    if (functionCalls.length > 0) {
      console.log(`[AI] Found ${functionCalls.length} function call(s)`)
      functionResults = await this.executeFunctionCalls(functionCalls, aiFunctions)
      
      // Remove function calls from response text
      response.text = response.text.replace(/\[CALL:[^\]]*\]/g, "").trim()
    }

    if (response.success) {
      this.addToHistory(userId, "user", message)
      this.addToHistory(userId, "model", response.text)
    }

    const result = {
      success: response.success,
      text: response.text,
      toolsUsed: toolResults.length > 0,
      toolResults: toolResults,
      functionCalls: functionCalls,
      functionResults: functionResults,
      intent: intent
    }

    console.log(`[AI] Processing complete!\n`)

    return result
  }

  async generateWithMCP(userId, message, mcpConnector, aiFunctions) {
    return this.processWithAI(userId, message, mcpConnector, aiFunctions)
  }

  getSessionInfo(userId) {
    const session = this.sessions.get(userId)
    if (!session) {
      return {
        exists: false,
        messageCount: 0,
        createdAt: null,
        lastActive: null
      }
    }

    return {
      exists: true,
      messageCount: session.history.length,
      createdAt: session.createdAt,
      lastActive: session.lastActive
    }
  }

  getAllSessionsCount() {
    return this.sessions.size
  }

  getPlatform() {
    return this.platform
  }

  getModel() {
    return this.model
  }

  async getOpenRouterModels() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "openrouter.ai",
        port: 443,
        path: "/api/v1/models",
        method: "GET",
        headers: {
          "Authorization": `Bearer ${global.openrouter.apikey}`
        }
      }

      const req = https.request(options, (res) => {
        let responseData = ""

        res.on("data", chunk => responseData += chunk)
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`OpenRouter API Error: ${res.statusCode}`))
            return
          }

          try {
            const parsed = JSON.parse(responseData)
            resolve(parsed.data || [])
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`))
          }
        })
      })

      req.on("error", reject)
      req.end()
    })
  }
}

module.exports = GeminiLogic
