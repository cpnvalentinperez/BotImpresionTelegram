const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs-extra');
const { exec } = require('child_process');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Ruta temporal
const TMP_DIR = './temp';
fs.ensureDirSync(TMP_DIR);

// Función para descargar el archivo
async function descargarArchivo(fileId, fileName, bot) {
  const file = await bot.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
  const outputPath = `${TMP_DIR}/${fileName}`;
  const response = await axios({ url, responseType: 'stream' });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outputPath));
    writer.on('error', reject);
  });
}

// Función para abrir archivo y simular Ctrl+P
function abrirArchivoParaRevisarYImprimir(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  
  // Abre el archivo con la app predeterminada (Windows)
  exec(`start "" "${filePath}"`, (err) => {
    if (err) {
      console.error('Error al abrir archivo:', err);
    } else {      
      // 🧹 Eliminar archivo después de 1 minuto
      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Error al eliminar archivo temporal:', err);
          }
        });
      }, 60 * 1000); // 60 segundos
    }
  });
}



// Al recibir fotos
bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo.slice(-1)[0]; // mayor resolución
  const fileId = photo.file_id;
  const fileName = `foto_${Date.now()}.jpg`;

  try {
    const filePath = await descargarArchivo(fileId, fileName, bot);
    abrirArchivoParaRevisarYImprimir(filePath);
    await ctx.reply('🖼️ Foto recibida. Mostrando para impresión');
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ Error al procesar la foto.');
  }
});

// Al recibir documentos (PDF, etc.)
bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  const fileId = doc.file_id;
  const fileName = `${Date.now()}_${doc.file_name}`;

  try {
    const filePath = await descargarArchivo(fileId, fileName, bot);
    abrirArchivoParaRevisarYImprimir(filePath);
    await ctx.reply('📄 Documento recibido. Mostrando para impresión');
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ Error al procesar el documento.');
  }
});

bot.launch();
console.log('🤖 Bot de impresión funcionando...');
