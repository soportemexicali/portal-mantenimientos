import pptxgen from "pptxgenjs";

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob || file instanceof File)) {
      return reject(new Error("El elemento proporcionado no es un archivo o Blob válido."));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

async function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 4, height: 3 });
    img.src = dataUrl;
  });
}

export async function generateMaintenancePptx({ agencyTitle, dept, notas, fotosAntesFiles = [], fotosDespuesFiles = [] }) {
  let pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  // Rutas directas desde la carpeta public que Vite sirve de forma estática
  const logoPath = '/assets/logo-grupo-optima.png';
  const bannerPath = '/assets/marcas-banner.png';

  // ----------------------------------------------------
  // DIAPOSITIVA 1: PORTADA
  // ----------------------------------------------------
  let slide1 = pres.addSlide();
  slide1.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: 'F4F5F7' } });
  
  slide1.addImage({ path: logoPath, x: 0.6, y: 0.5, w: 2.2, h: 0.6 });

  slide1.addText("MANTENIMIENTO EQUIPO", {
    x: 1.0, y: 2.3, w: '80%', h: 1.2,
    fontSize: 36, bold: true, color: '1A1A1A', fontFace: 'Arial'
  });

  slide1.addText(agencyTitle || "GRUPO ÓPTIMA", {
    x: 1.0, y: 3.4, w: '80%', h: 0.6,
    fontSize: 20, color: 'D9383E', fontFace: 'Arial'
  });

  slide1.addShape(pres.ShapeType.rect, { x: 0, y: 5.625, w: '100%', h: 0.9, fill: { color: 'D9383E' } });
  
  slide1.addImage({ path: bannerPath, x: 0.8, y: 5.75, w: 8.5, h: 0.65 });

  // ----------------------------------------------------
  // DIAPOSITIVAS DE COMPARACIÓN
  // ----------------------------------------------------
  const maxParejas = Math.max(fotosAntesFiles.length, fotosDespuesFiles.length, 1);

  for (let i = 0; i < maxParejas; i++) {
    let slide = pres.addSlide();

    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '0.85', fill: { color: 'D9383E' } });
    
    slide.addImage({ path: logoPath, x: 0.5, y: 0.15, w: 1.8, h: 0.55 });

    slide.addText(`${agencyTitle} — ${dept} (Vista ${i + 1} de ${maxParejas})`, {
      x: '0.5', y: '1.05', w: '90%', h: '0.5',
      fontSize: 18, bold: true, color: '1A1A1A', fontFace: 'Arial'
    });

    slide.addText("Antes", { x: '0.8', y: '1.6', w: '3.8', h: '0.3', fontSize: 14, bold: true, color: '555555', align: 'center' });
    slide.addText("Después", { x: '5.4', y: '1.6', w: '3.8', h: '0.3', fontSize: 14, bold: true, color: '555555', align: 'center' });

    slide.addShape(pres.ShapeType.line, { x: 5.0, y: 2.0, w: 0, h: 3.2, line: { color: 'D9383E', width: 2 } });

    const boxW = 3.8;
    const boxH = 3.1;
    const boxXAntes = 0.8;
    const boxXDespues = 5.4;
    const boxY = 2.0;

    // Foto "Antes"
    if (fotosAntesFiles[i]) {
      try {
        const antesDataUrl = await fileToDataUrl(fotosAntesFiles[i]);
        const dims = await getImageDimensions(antesDataUrl);
        const ratio = Math.min(boxW / dims.width, boxH / dims.height);
        const finalW = dims.width * ratio;
        const finalH = dims.height * ratio;
        const posX = boxXAntes + (boxW - finalW) / 2;
        const posY = boxY + (boxH - finalH) / 2;

        slide.addImage({ data: antesDataUrl, x: posX, y: posY, w: finalW, h: finalH });
      } catch (err) {
        console.error("Error al procesar foto antes:", err);
      }
    } else {
      slide.addText("Sin foto", { x: boxXAntes, y: boxY + 1.2, w: boxW, h: 0.5, fontSize: 12, color: '888888', align: 'center' });
    }

    // Foto "Después"
    if (fotosDespuesFiles[i]) {
      try {
        const despuesDataUrl = await fileToDataUrl(fotosDespuesFiles[i]);
        const dims = await getImageDimensions(despuesDataUrl);
        const ratio = Math.min(boxW / dims.width, boxH / dims.height);
        const finalW = dims.width * ratio;
        const finalH = dims.height * ratio;
        const posX = boxXDespues + (boxW - finalW) / 2;
        const posY = boxY + (boxH - finalH) / 2;

        slide.addImage({ data: despuesDataUrl, x: posX, y: posY, w: finalW, h: finalH });
      } catch (err) {
        console.error("Error al procesar foto después:", err);
      }
    } else {
      slide.addText("Sin foto", { x: boxXDespues, y: boxY + 1.2, w: boxW, h: 0.5, fontSize: 12, color: '888888', align: 'center' });
    }

    slide.addText(`Fecha: ${new Date().toLocaleDateString()} | Notas: ${notas || 'Sin observaciones'}`, {
      x: '0.5', y: '5.35', w: '90%', h: '0.3',
      fontSize: 10, color: '666666', fontFace: 'Arial'
    });
  }

  await pres.writeFile({ fileName: `Mantenimiento_${agencyTitle || 'Agencia'}_${dept}.pptx` });
}