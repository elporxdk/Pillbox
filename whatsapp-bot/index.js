require("dotenv").config();

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error(
    "Falta ANTHROPIC_API_KEY. Copia .env.example a .env y pon tu clave de https://console.anthropic.com/settings/keys"
  );
  process.exit(1);
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

// Cuantos mensajes (usuario + bot) se guardan por chat antes de recortar.
// Cada mensaje cuesta tokens en cada turno, asi que no crece sin limite.
const MAX_HISTORIAL = 20;

const SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Medibot, un proyecto estudiantil de
robotica medica (termostato movil con monitoreo y tres subsistemas integrados).
Respondes en el mismo idioma que te escriben, con mensajes cortos y claros,
adecuados para un chat de WhatsApp (no uses markdown ni tablas). Si te
preguntan algo que no sabes sobre el proyecto, dilo con honestidad en vez de
inventar datos.`;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Historial de conversacion por chat, en memoria: se pierde al reiniciar el bot.
const historiales = new Map();

function historialDe(chatId) {
  if (!historiales.has(chatId)) {
    historiales.set(chatId, []);
  }
  return historiales.get(chatId);
}

async function responder(chatId, textoUsuario) {
  const historial = historialDe(chatId);
  historial.push({ role: "user", content: textoUsuario });

  const respuesta = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: historial,
  });

  const texto = respuesta.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("\n")
    .trim();

  historial.push({ role: "assistant", content: texto });
  // Recorta por los dos extremos para no romper la alternancia user/assistant.
  while (historial.length > MAX_HISTORIAL) {
    historial.shift();
    historial.shift();
  }

  return texto;
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  console.log("Escanea este QR desde WhatsApp > Dispositivos vinculados:\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot conectado y escuchando mensajes de WhatsApp.");
});

client.on("auth_failure", (mensaje) => {
  console.error("Fallo de autenticacion:", mensaje);
});

client.on("disconnected", (razon) => {
  console.warn("WhatsApp se desconecto:", razon);
});

client.on("message", async (msg) => {
  // Ignora grupos, difusiones/estados y mensajes propios: el bot solo
  // conversa uno a uno con quien le escribe.
  if (msg.from.endsWith("@g.us") || msg.from === "status@broadcast" || msg.fromMe) {
    return;
  }
  if (!msg.body || !msg.body.trim()) {
    return;
  }

  const chat = await msg.getChat();
  try {
    await chat.sendStateTyping();
    const texto = await responder(msg.from, msg.body.trim());
    await msg.reply(texto);
  } catch (error) {
    console.error(`Error respondiendo a ${msg.from}:`, error);
    await msg.reply(
      "Tuve un problema respondiendo justo ahora. Intenta de nuevo en un momento."
    );
  }
});

client.initialize();
