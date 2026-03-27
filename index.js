// index.js - Entry Point

require("./settings.js")

const Agent = require("./agent.js")

function validateConfig() {
  const errors = []

  if (!global.token || global.token === "") {
    errors.push("global.token - Telegram Bot Token belum diisi")
  }

  if (!global.ownid || global.ownid === "") {
    errors.push("global.ownid - Owner ID belum diisi")
  }

  if (!global.platfrom || global.platfrom === "") {
    errors.push("global.platfrom - Platform belum diisi (gemini/openrouter)")
  }

  if (global.platfrom === "gemini") {
    if (!global.gemini || !global.gemini.apikey || global.gemini.apikey === "") {
      errors.push("global.gemini.apikey - Gemini API Key belum diisi")
    }
    if (!global.gemini || !global.gemini.model || global.gemini.model === "") {
      errors.push("global.gemini.model - Gemini Model belum diisi")
    }
  } else if (global.platfrom === "openrouter") {
    if (!global.openrouter || !global.openrouter.apikey || global.openrouter.apikey === "") {
      errors.push("global.openrouter.apikey - OpenRouter API Key belum diisi")
    }
    if (!global.openrouter_config || !global.openrouter_config.model || global.openrouter_config.model === "") {
      errors.push("global.openrouter_config.model - OpenRouter Model belum diisi")
    }
  } else {
    errors.push("global.platfrom - Platform harus 'gemini' atau 'openrouter'")
  }

  if (errors.length > 0) {
    console.error("")
    console.error("❌ KONFIGURASI TIDAK VALID")
    console.error("=".repeat(50))
    errors.forEach(err => console.error(`  • ${err}`))
    console.error("=".repeat(50))
    console.error("")
    console.error("Silakan edit settings.js dan isi konfigurasi yang diperlukan.")
    console.error("")
    process.exit(1)
  }

  console.log("")
  console.log("✅ Konfigurasi valid.")
  console.log(`   Platform: ${global.platfrom}`)
  console.log(`   Model: ${global.platfrom === "gemini" ? global.gemini.model : global.openrouter_config.model}`)
  console.log("")
}

async function main() {
  console.log("")
  console.log("=".repeat(50))
  console.log("   Telegraf Gemini MCP Bot")
  console.log("=".repeat(50))
  console.log("")

  validateConfig()

  const agent = new Agent()
  await agent.launch()

  console.log("=".repeat(50))
  console.log("Bot siap digunakan!")
  console.log("=".repeat(50))
  console.log("")
}

main().catch(err => {
  console.error("")
  console.error("❌ Fatal error:", err)
  console.error("")
  process.exit(1)
})
