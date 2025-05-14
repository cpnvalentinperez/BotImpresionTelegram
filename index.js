const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs-extra');
const { exec } = require('child_process');
require('dotenv').config();
const path = require('path');
const printer = require("pdf-to-printer");
const PDFDocument = require('pdfkit');

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

// async function abrirArchivoParaRevisarYImprimir(filePath) {
//   const absolutePath = path.resolve(filePath);

//   if (absolutePath.toLowerCase().endsWith('.pdf')) {
//     // Imprimir PDF
//     printer
//       .print(absolutePath)
//       .then(() => console.log('🖨️ PDF enviado a la impresora'))
//       .catch((err) => console.error('❌ Error al imprimir PDF:', err));
//   } else if (/\.(jpg|jpeg|png|bmp)$/i.test(absolutePath)) {
//     // Convertir imagen a PDF e imprimir
//     const pdfTempPath = absolutePath.replace(path.extname(absolutePath), '.pdf');
//     try {
//       await convertirImagenAPdf(absolutePath, pdfTempPath);
//       await printer.print(pdfTempPath);
//       console.log('🖼️ Imagen convertida y enviada a la impresora');

//       // Borrar imagen y PDF después de 1 minuto
//       setTimeout(() => {
//         fs.unlink(absolutePath).catch(console.error);
//         fs.unlink(pdfTempPath).catch(console.error);
//       }, 60 * 1000);
//     } catch (err) {
//       console.error('❌ Error al imprimir imagen:', err);
//     }
//   } else {
//     // Otro tipo de archivo: abrir para revisión
//     exec(`start "" "${absolutePath}"`, (err) => {
//       if (err) {
//         console.error('❌ Error al abrir archivo:', err);
//         return;
//       }
//       console.log('📂 Archivo abierto para revisión.');

//       // Borrar después de 1 minuto
//       setTimeout(() => {
//         fs.unlink(absolutePath).catch(console.error);
//       }, 60 * 1000);
//     });
//   }
// }

async function abrirArchivoParaRevisarYImprimir(filePath) {
  const absolutePath = path.resolve(filePath);
  const sistemaOperativo = process.platform; // 'win32', 'linux', 'darwin', etc.
  console.log('🖥️ Sistema operativo detectado:', sistemaOperativo);

  // Función para imprimir en Linux con lp
  function imprimirEnLinux(ruta) {
    exec(`lp "${ruta}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error al imprimir en Linux:', error);
      } else {
        console.log('🖨️ Archivo enviado a la impresora en Linux');
      }
    });
  }

  // Si es PDF
  if (absolutePath.toLowerCase().endsWith('.pdf')) {
    try {
      if (sistemaOperativo === 'win32' || sistemaOperativo === 'darwin') {
        await printer.print(absolutePath);
        console.log('🖨️ PDF enviado a la impresora');
      } else if (sistemaOperativo === 'linux') {
        imprimirEnLinux(absolutePath);
      } else {
        console.error('❌ Sistema operativo no soportado para impresión.');
      }
    } catch (err) {
      console.error('❌ Error al imprimir PDF:', err);
    }
  }

  // Si es imagen
  else if (/\.(jpg|jpeg|png|bmp)$/i.test(absolutePath)) {
    const pdfTempPath = absolutePath.replace(path.extname(absolutePath), '.pdf');
    try {
      await convertirImagenAPdf(absolutePath, pdfTempPath);

      if (sistemaOperativo === 'win32' || sistemaOperativo === 'darwin') {
        await printer.print(pdfTempPath);
        console.log('🖼️ Imagen convertida y enviada a la impresora');
      } else if (sistemaOperativo === 'linux') {
        imprimirEnLinux(pdfTempPath);
      } else {
        console.error('❌ Sistema operativo no soportado para impresión.');
      }

      // Borrar archivos después de 1 minuto
      setTimeout(() => {
        fs.unlink(absolutePath).catch(console.error);
        fs.unlink(pdfTempPath).catch(console.error);
      }, 60 * 1000);
    } catch (err) {
      console.error('❌ Error al imprimir imagen:', err);
    }
  }

  // Otros tipos de archivos: solo abrir para revisión
  else {
    const comandoAbrir = sistemaOperativo === 'win32'
      ? `start "" "${absolutePath}"`
      : sistemaOperativo === 'linux'
        ? `xdg-open "${absolutePath}"`
        : `open "${absolutePath}"`;

    exec(comandoAbrir, (err) => {
      if (err) {
        console.error('❌ Error al abrir archivo:', err);
      } else {
        console.log('📂 Archivo abierto para revisión.');
      }

      // Eliminar archivo tras 1 minuto
      setTimeout(() => {
        fs.unlink(absolutePath).catch(console.error);
      }, 60 * 1000);
    });
  }
}



// Esta es la forma correcta de convertir una imagen a PDF usando image-to-pdf
async function convertirImagenAPdf(imagenPath, destinoPdfPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(destinoPdfPath);

    doc.pipe(writeStream);

    const image = doc.openImage ? doc.openImage(imagenPath) : imagenPath;

    doc.addPage({ size: 'A4', layout: 'portrait' });
    doc.image(image, {
      fit: [500, 750],
      align: 'center',
      valign: 'center'
    });

    doc.end();

    writeStream.on('finish', () => resolve(destinoPdfPath));
    writeStream.on('error', reject);
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
    await ctx.reply('🖼️ Foto recibida. Se envio para impresión');
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
    await ctx.reply('📄 Documento recibido. Se envio para impresión');
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ Error al procesar el documento.');
  }
});

bot.launch();
console.log('🤖 Bot de impresión funcionando...');
