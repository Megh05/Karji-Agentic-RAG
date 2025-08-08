import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import csv from 'csv-parser';
import fs from 'fs';


export interface ProcessedDocument {
  content: string;
  metadata: {
    filename: string;
    fileType: string;
    chunkIndex?: number;
    pageNumber?: number;
    totalChunks?: number;
  };
}

export class DocumentProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', '']
    });
  }

  public async processFile(filePath: string, originalName: string, mimeType: string): Promise<ProcessedDocument[]> {
    let content = '';
    
    try {
      switch (true) {
        case mimeType.includes('pdf'):
          content = await this.processPDF(filePath);
          break;
        case mimeType.includes('word') || originalName.endsWith('.docx'):
          content = await this.processWord(filePath);
          break;
        case mimeType.includes('excel') || originalName.endsWith('.xlsx') || originalName.endsWith('.xls'):
          content = await this.processExcel(filePath);
          break;
        case mimeType.includes('csv') || originalName.endsWith('.csv'):
          content = await this.processCSV(filePath);
          break;
        case mimeType.includes('text') || originalName.endsWith('.txt'):
          content = await this.processText(filePath);
          break;
        default:
          // Try to read as text
          content = await this.processText(filePath);
      }

      // Split content into chunks
      const documents = await this.textSplitter.createDocuments([content]);
      
      return documents.map((doc, index) => ({
        content: doc.pageContent,
        metadata: {
          filename: originalName,
          fileType: mimeType,
          chunkIndex: index,
          totalChunks: documents.length
        }
      }));

    } catch (error) {
      console.error(`Error processing file ${originalName}:`, error);
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processPDF(filePath: string): Promise<string> {
    try {
      // Ensure file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`PDF file not found: ${filePath}`);
      }
      
      // Dynamic import to handle pdf-parse issues
      const pdfParse = (await import('pdf-parse')).default;
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text || '';
    } catch (error) {
      console.error('PDF parsing error:', error);
      // Fallback: return empty string instead of trying to read as UTF-8
      return '';
    }
  }

  private async processWord(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async processExcel(filePath: string): Promise<string> {
    const workbook = XLSX.readFile(filePath);
    let content = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      content += `\n--- Sheet: ${sheetName} ---\n`;
      jsonData.forEach((row: any) => {
        if (Array.isArray(row) && row.length > 0) {
          content += row.join(' | ') + '\n';
        }
      });
    });
    
    return content;
  }

  private async processCSV(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = fs.createReadStream(filePath);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          let content = '';
          if (results.length > 0) {
            // Add headers
            const headers = Object.keys(results[0]);
            content += headers.join(' | ') + '\n';
            content += headers.map(() => '---').join(' | ') + '\n';
            
            // Add data rows
            results.forEach(row => {
              content += Object.values(row).join(' | ') + '\n';
            });
          }
          resolve(content);
        })
        .on('error', reject);
    });
  }

  private async processText(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf8');
  }

  public createProductDocument(product: any): ProcessedDocument {
    const content = `Title: ${product.title}
Description: ${product.description || 'No description'}
Price: ${product.price || 'N/A'}
${product.discountPrice ? `Discount Price: ${product.discountPrice}` : ''}
Brand: ${product.brand || 'N/A'}
Availability: ${product.availability || 'N/A'}
Condition: ${product.condition || 'N/A'}
${Object.entries(product.additionalFields || {}).map(([key, value]) => `${key}: ${value}`).join('\n')}`;

    return {
      content,
      metadata: {
        filename: `product_${product.id}`,
        fileType: 'product',
        productId: product.id,
        title: product.title,
        price: product.price,
        discountPrice: product.discountPrice
      }
    };
  }
}

export const documentProcessor = new DocumentProcessor();