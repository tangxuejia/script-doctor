'use client';

/**
 * Read and extract text from .txt, .docx, and .pdf files.
 * Returns the extracted text content.
 */
export async function readFileContent(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'txt':
      return readTextFile(file);

    case 'docx':
      return readDocxFile(file);

    case 'doc':
      // .doc (legacy) is not directly supported; fallback to binary read
      throw new Error('.doc 格式暂不支持，请转为 .docx 后再上传');

    case 'pdf':
      return readPdfFile(file);

    default:
      throw new Error(`不支持的格式 .${ext}，请上传 .txt / .docx / .pdf 文件`);
  }
}

/** Read plain text file */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

/** Read .docx file using mammoth */
async function readDocxFile(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (!result.value.trim()) {
    throw new Error('无法从 .docx 文件中提取文字，文件可能为空');
  }
  return result.value;
}

/** Read .pdf file using pdfjs-dist */
async function readPdfFile(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  // Set worker path to avoid version mismatch warnings
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const texts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => (item as { str: string }).str)
      .join(' ');
    texts.push(pageText);
  }

  const result = texts.join('\n\n');
  if (!result.trim()) {
    throw new Error('无法从 PDF 文件中提取文字，可能是扫描件或图片型 PDF');
  }
  return result;
}
