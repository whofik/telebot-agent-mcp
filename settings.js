global.token = "7555332032:xxxxx"  // token botb kamu
global.ownid = "xxxx" // id tele kamu

global.platfrom = "openrouter"  // gemini or open openrouter

// gemini settings
global.gemini = {
  apikey: "AIzaSxxxxxx",
  model: "gemini-2.0-flash-exp"
}

// openrouter settings apikey
global.openrouter = {
  apikey: "sk-or-v1-xxxx"
}

global.openrouter_config = {
  model: "google/gemini-2.5-flash-lite",
  temperature: 0.7,
  max_tokens: 2000
}

global.mcp = {
  enabled: true,
  tools: ["search", "calculator", "weather", "time"]
}

global.ai = {
  platfrom: global.platfrom,
  model: global.platfrom === "gemini" ? global.gemini.model : global.openrouter_config.model,
  systemPrompt: "Kamu adalah asisten Telegram yang ramah dan membantu. Jawab dengan natural, santai, dan friendly dalam bahasa Indonesia."
}

global.session = {
  maxHistory: 50,
  ttl: 86400000
}

module.exports = {
  token: global.token,
  ownid: global.ownid,
  platfrom: global.platfrom,
  gemini: global.gemini,
  openrouter: global.openrouter,
  openrouter_config: global.openrouter_config,
  mcp: global.mcp,
  ai: global.ai,
  session: global.session
}

