/**
 * Módulo de reportes: resumen en texto, envío por correo y WhatsApp (demo o real).
 * Para demo: sin SMTP/Twilio se devuelve el contenido para mostrarlo en la app.
 */

const fs = require("fs");
const path = require("path");

const DEMO_OUTPUT_DIR = path.join(__dirname, "output");

function ensureDemoDir() {
  if (!fs.existsSync(DEMO_OUTPUT_DIR)) {
    fs.mkdirSync(DEMO_OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Genera resumen en lenguaje natural a partir del objeto summary (template; opcionalmente con OpenAI).
 * @param {object} summary - { coberturaPct, coveredLatest, countedLatest, shortageLatest, delayByType, comparativa: { proveedor, almacenista }, latestDay }
 * @returns {string}
 */
function generarResumenAI(summary) {
  if (!summary) return "Sin datos para generar resumen.";
  const pct = summary.coberturaPct ?? 0;
  const meta = 95;
  const covered = summary.coveredLatest ?? 0;
  const total = summary.countedLatest ?? 0;
  const faltante = Math.round(summary.shortageLatest ?? 0);
  const prov = summary.comparativa?.proveedor ?? {};
  const alm = summary.comparativa?.almacenista ?? {};
  const delays = summary.delayByType ?? [];
  const day = summary.latestDay ? new Date(summary.latestDay).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "hoy";

  let texto = `Resumen operativo (${day}). `;
  texto += `Cobertura de piezas: ${pct}% (meta ${meta}%). `;
  if (pct >= meta) texto += "Objetivo cumplido. ";
  else texto += `Faltan ${(meta - pct).toFixed(1)} puntos para la meta. `;
  texto += `Piezas-zona con stock OK: ${covered} de ${total}. `;
  if (faltante > 0) texto += `Faltante total: ${faltante.toLocaleString("es-MX")} piezas. `;
  texto += `Proveedor: ${prov.pct ?? 0}% a tiempo (${prov.aTiempo ?? 0}/${prov.total ?? 0} ciclos). `;
  texto += `Almacenista/Planta: ${alm.pct ?? 0}% a tiempo (${alm.aTiempo ?? 0}/${alm.total ?? 0} ciclos). `;
  if (delays.length > 0) {
    texto += "Retrasos por causa: ";
    texto += delays.map((d) => `${d.label} (${d.count}, ${d.minutes} min)`).join("; ") + ". ";
  }
  texto += "Importante para manejo de negocio.";
  return texto;
}

/**
 * Construye el cuerpo del reporte en texto plano y HTML.
 */
function construirContenidoReporte(summary, resumenAI) {
  const pct = summary?.coberturaPct ?? 0;
  const covered = summary?.coveredLatest ?? 0;
  const total = summary?.countedLatest ?? 0;
  const faltante = Math.round(summary?.shortageLatest ?? 0);
  const prov = summary?.comparativa?.proveedor ?? {};
  const alm = summary?.comparativa?.almacenista ?? {};
  const delays = summary?.delayByType ?? [];
  const day = summary?.latestDay ? new Date(summary.latestDay).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  let texto = `REPORTE JIT - Torre de Control\n`;
  texto += `Fecha: ${day}\n\n`;
  texto += `COBERTURA: ${pct}%\n`;
  texto += `Piezas con stock OK: ${covered} de ${total}\n`;
  texto += `Faltante: ${faltante.toLocaleString("es-MX")} piezas\n\n`;
  texto += `COMPARATIVA\n`;
  texto += `Proveedor: ${prov.pct ?? 0}% a tiempo (${prov.aTiempo ?? 0}/${prov.total ?? 0})\n`;
  texto += `Almacenista: ${alm.pct ?? 0}% a tiempo (${alm.aTiempo ?? 0}/${alm.total ?? 0})\n\n`;
  if (delays.length > 0) {
    texto += `TIPOS DE RETRASO\n`;
    delays.forEach((d) => {
      texto += `- ${d.label}: ${d.count} veces, ${d.minutes} min\n`;
    });
    texto += "\n";
  }
  if (resumenAI) {
    texto += `RESUMEN (IA)\n${resumenAI}\n`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reporte JIT</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1 style="color:#001e50;">Reporte JIT - Torre de Control</h1>
  <p><strong>Fecha:</strong> ${day}</p>
  <h2>Cobertura</h2>
  <p>Cobertura: <strong>${pct}%</strong><br/>
  Piezas con stock OK: ${covered} de ${total}<br/>
  Faltante: <strong>${faltante.toLocaleString("es-MX")} piezas</strong></p>
  <h2>Comparativa proveedor y almacenista</h2>
  <p>Proveedor: <strong>${prov.pct ?? 0}%</strong> a tiempo (${prov.aTiempo ?? 0}/${prov.total ?? 0})<br/>
  Almacenista: <strong>${alm.pct ?? 0}%</strong> a tiempo (${alm.aTiempo ?? 0}/${alm.total ?? 0})</p>
  ${delays.length > 0 ? `<h2>Tipos de retraso</h2><ul>${delays.map((d) => `<li>${d.label}: ${d.count} veces, ${d.minutes} min</li>`).join("")}</ul>` : ""}
  ${resumenAI ? `<h2>Resumen en lenguaje natural</h2><p style="background:#f0f9ff;padding:12px;border-radius:8px;">${resumenAI.replace(/\n/g, "<br/>")}</p>` : ""}
  <hr/><p style="color:#64748b;font-size:12px;">JIT Monitor - VW Puebla / DHL</p>
</body>
</html>`;

  return { texto, html };
}

/**
 * Envía correo. Si no hay SMTP configurado, guarda en output/demo-email y devuelve contenido.
 */
async function enviarCorreo(emails, asunto, texto, html) {
  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (hasSmtp) {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: emails.join(", "),
      subject: asunto,
      text: texto,
      html: html,
    });
    return { enviado: true, demo: false };
  }

  ensureDemoDir();
  const demoPath = path.join(DEMO_OUTPUT_DIR, "demo-email.html");
  fs.writeFileSync(demoPath, html, "utf8");
  const demoTextoPath = path.join(DEMO_OUTPUT_DIR, "demo-email.txt");
  fs.writeFileSync(demoTextoPath, texto, "utf8");
  return {
    enviado: false,
    demo: true,
    mensaje: "Modo demo: correo no enviado. Contenido guardado en server/output/ para que puedas abrirlo y mostrarlo.",
    contenidoTexto: texto,
    contenidoHtml: html,
    rutaArchivo: demoPath,
  };
}

/**
 * "Envía" WhatsApp. Si Twilio no está configurado, devuelve el mensaje para mostrarlo (demo).
 * Para envío real: instala twilio, configura TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
 */
async function enviarWhatsApp(phones, mensaje) {
  const hasTwilio =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM;

  if (hasTwilio && phones.length > 0) {
    try {
      const twilio = require("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const from = process.env.TWILIO_WHATSAPP_FROM;
      const results = await Promise.all(
        phones.map((to) => {
          const toNum = to.replace(/\D/g, "");
          const toWhatsApp = toNum.length <= 10 ? `whatsapp:+52${toNum}` : `whatsapp:+${toNum}`;
          return client.messages.create({ from, to: toWhatsApp, body: mensaje });
        })
      );
      return {
        enviado: true,
        demo: false,
        mensaje: `WhatsApp enviado a ${phones.length} número(s).`,
        mensajeWhatsApp: mensaje,
      };
    } catch (e) {
      return {
        enviado: false,
        demo: true,
        mensajeWhatsApp: mensaje,
        mensaje: `Error al enviar WhatsApp: ${e.message || "revisa Twilio y variables de entorno."}`,
      };
    }
  }

  return Promise.resolve({
    enviado: false,
    demo: true,
    mensajeWhatsApp: mensaje,
    mensaje: "Modo demo: WhatsApp no configurado. Usa el texto siguiente para mostrar qué se enviaría por WhatsApp.",
  });
}

module.exports = {
  generarResumenAI,
  construirContenidoReporte,
  enviarCorreo,
  enviarWhatsApp,
  ensureDemoDir,
};
