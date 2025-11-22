import fs from 'fs';
import path from 'path';

const IS_RENDER = process.env.RENDER === 'true' || process.env.PERSISTENT_STORAGE === 'enabled';
const PERSISTENT_ROOT = process.env.DATA_DIR || '/data/DATA';
const LOCAL_ROOT = path.resolve(process.cwd(), 'DATA');

export const storageConfig = {
  isRender: IS_RENDER,
  dataDir: IS_RENDER ? PERSISTENT_ROOT : LOCAL_ROOT,
  get rootPath() {
    return IS_RENDER ? '/data' : process.cwd();
  }
};

export function ensureDataDirectory(): void {
  const dataPath = storageConfig.dataDir;
  
  if (!fs.existsSync(dataPath)) {
    console.log(`[Storage] Creating DATA directory at: ${dataPath}`);
    fs.mkdirSync(dataPath, { recursive: true });
  }
  
  console.log(`[Storage] Using DATA directory: ${dataPath}`);
  console.log(`[Storage] Environment: ${IS_RENDER ? 'Render (persistent disk)' : 'Local development'}`);
}

export function getDataFilePath(filename: string): string {
  return path.join(storageConfig.dataDir, filename);
}

export function saveDataFile(filename: string, content: Buffer | string): void {
  ensureDataDirectory();
  const filePath = getDataFilePath(filename);
  
  console.log(`[Storage] Writing file: ${filePath}`);
  fs.writeFileSync(filePath, content);
  console.log(`[Storage] ✅ File saved successfully: ${filename}`);
}

export function readDataFile(filename: string): Buffer | null {
  const filePath = getDataFilePath(filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`[Storage] File not found: ${filePath}`);
    return null;
  }
  
  return fs.readFileSync(filePath);
}

export function listDataFiles(): string[] {
  ensureDataDirectory();
  const dataPath = storageConfig.dataDir;
  
  if (!fs.existsSync(dataPath)) {
    return [];
  }
  
  return fs.readdirSync(dataPath).filter(file => {
    return file.endsWith('.xlsx') || 
           file.endsWith('.csv') || 
           file.endsWith('.ics') ||
           file.endsWith('.json');
  });
}

export function deleteDataFile(filename: string): void {
  const filePath = getDataFilePath(filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`[Storage] File deleted: ${filename}`);
  }
}

export function initializeStorage(): void {
  ensureDataDirectory();
  
  const files = listDataFiles();
  console.log(`[Storage] Found ${files.length} data files:`, files);
  
  if (IS_RENDER && files.length === 0) {
    console.log('[Storage] ⚠️  No data files found on persistent disk.');
    console.log('[Storage] Please upload your DATA files (cruises.xlsx, booked.xlsx, offers.xlsx, calendar.ics, tripit.ics)');
  }
}

export default {
  config: storageConfig,
  ensureDataDirectory,
  getDataFilePath,
  saveDataFile,
  readDataFile,
  listDataFiles,
  deleteDataFile,
  initializeStorage
};
