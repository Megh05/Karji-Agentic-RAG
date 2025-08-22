import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export class FileStorageService {
  private static instance: FileStorageService;
  private baseUploadPath = './uploads';
  
  private constructor() {
    this.ensureDirectoriesExist();
  }

  public static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  private ensureDirectoriesExist(): void {
    const directories = [
      this.baseUploadPath,
      path.join(this.baseUploadPath, 'documents'),
      path.join(this.baseUploadPath, 'merchant-feeds'),
      path.join(this.baseUploadPath, 'offers'),
      path.join(this.baseUploadPath, 'embeddings'),
      path.join(this.baseUploadPath, 'processed')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  public async storeFile(
    tempFilePath: string, 
    originalName: string, 
    sourceType: 'documents' | 'merchant-feeds' | 'offers',
    mimeType: string
  ): Promise<{ fileName: string; filePath: string }> {
    const extension = path.extname(originalName);
    const fileName = `${nanoid()}_${Date.now()}${extension}`;
    const targetDir = path.join(this.baseUploadPath, sourceType);
    const filePath = path.join(targetDir, fileName);

    // Copy file to permanent location
    fs.copyFileSync(tempFilePath, filePath);
    
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    console.log(`File stored: ${filePath}`);
    return { fileName, filePath };
  }

  public async storeProcessedData(
    data: any, 
    fileName: string, 
    sourceType: string
  ): Promise<string> {
    const processedDir = path.join(this.baseUploadPath, 'processed');
    const dataFileName = `${sourceType}_${fileName}_${Date.now()}.json`;
    const dataFilePath = path.join(processedDir, dataFileName);

    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log(`Processed data stored: ${dataFilePath}`);
    return dataFilePath;
  }

  public async storeEmbeddings(
    embeddings: any[], 
    sourceId: string, 
    sourceType: string
  ): Promise<string> {
    const embeddingsDir = path.join(this.baseUploadPath, 'embeddings');
    this.ensureDirectoriesExist();
    
    // Sanitize sourceId to create valid filename (remove invalid characters)
    const sanitizedId = sourceId.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const embeddingFileName = `${sourceType}_${sanitizedId}_${Date.now()}.json`;
    const embeddingFilePath = path.join(embeddingsDir, embeddingFileName);

    const embeddingData = {
      sourceId,
      sourceType,
      embeddings,
      createdAt: new Date().toISOString(),
      count: embeddings.length
    };

    fs.writeFileSync(embeddingFilePath, JSON.stringify(embeddingData, null, 2));
    console.log(`Embeddings stored: ${embeddingFilePath} (${embeddings.length} embeddings)`);
    return embeddingFilePath;
  }

  public async storeMerchantFeedData(
    products: any[], 
    feedId: string, 
    feedUrl: string
  ): Promise<string> {
    const merchantDir = path.join(this.baseUploadPath, 'merchant-feeds');
    const dataFileName = `feed_${feedId}_${Date.now()}.json`;
    const dataFilePath = path.join(merchantDir, dataFileName);

    const feedData = {
      feedId,
      feedUrl,
      products,
      importedAt: new Date().toISOString(),
      productCount: products.length
    };

    fs.writeFileSync(dataFilePath, JSON.stringify(feedData, null, 2));
    console.log(`Merchant feed data stored: ${dataFilePath} (${products.length} products)`);
    return dataFilePath;
  }

  public getFile(filePath: string): Buffer | null {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
      return null;
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  }

  public deleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File deleted: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  public getUploadStats(): {
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  } {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byType: {} as Record<string, { count: number; size: number }>
    };

    const scanDirectory = (dirPath: string, type: string) => {
      if (!fs.existsSync(dirPath)) return;

      const files = fs.readdirSync(dirPath);
      let typeCount = 0;
      let typeSize = 0;

      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const fileStat = fs.statSync(filePath);
        
        if (fileStat.isFile()) {
          typeCount++;
          typeSize += fileStat.size;
        }
      });

      stats.byType[type] = { count: typeCount, size: typeSize };
      stats.totalFiles += typeCount;
      stats.totalSize += typeSize;
    };

    scanDirectory(path.join(this.baseUploadPath, 'documents'), 'documents');
    scanDirectory(path.join(this.baseUploadPath, 'merchant-feeds'), 'merchant-feeds');
    scanDirectory(path.join(this.baseUploadPath, 'offers'), 'offers');
    scanDirectory(path.join(this.baseUploadPath, 'embeddings'), 'embeddings');
    scanDirectory(path.join(this.baseUploadPath, 'processed'), 'processed');

    return stats;
  }
}

export const fileStorageService = FileStorageService.getInstance();