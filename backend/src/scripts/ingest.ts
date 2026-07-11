import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { config, checkRequiredEnv } from '../config.js';
import { initVectorDb, insertChunk } from '../services/vectorStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ingestion entry point
async function runIngestion() {
  console.info('[INGESTION] Starting NDRF guidelines ingestion pipeline...');
  
  checkRequiredEnv();

  // 1. Initialize Vector Database
  const dbConnected = await initVectorDb();
  console.info(`[INGESTION] DB Init status: ${dbConnected ? 'CONNECTED' : 'FALLBACK TO IN-MEMORY'}`);

  // 2. Read Guidelines File
  const filePath = path.resolve(__dirname, '../../../data/ndrf_guidelines.txt');
  if (!fs.existsSync(filePath)) {
    console.error(`[INGESTION] Guidelines file not found at: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // 3. Chunk guidelines by lines / paragraphs / subsections
  const lines = fileContent.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split by sections or markdown headings to keep context together
    if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmed + '\n';
    } else {
      currentChunk += trimmed + ' ';
      // If chunk size is getting reasonable, split it
      if (currentChunk.length > 300) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  console.info(`[INGESTION] Document parsed into ${chunks.length} chunks.`);

  // 4. Generate Embeddings and Save
  const openai = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.info(`[INGESTION] Processing chunk ${i + 1}/${chunks.length}...`);

    let embedding: number[] = [];

    if (openai) {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
        });
        embedding = response.data[0].embedding;
      } catch (error: any) {
        console.error(`[INGESTION] OpenAI embedding failed for chunk ${i}:`, error.message);
        embedding = generatePseudoEmbedding(chunk);
      }
    } else {
      // Create a pseudo-embedding for testing when no OpenAI key is available
      embedding = generatePseudoEmbedding(chunk);
    }

    const metadata = `NDRF Guidelines Section - Chunk ${i + 1}`;
    await insertChunk(chunk, metadata, embedding);
  }

  console.info('[INGESTION] Ingestion pipeline successfully completed.');
  if (!openai) {
    console.warn('[INGESTION] Ingestion completed using pseudo-embeddings because OPENAI_API_KEY was not configured.');
  }
}

/**
 * Creates a deterministic mock embedding vector (1536 floats) based on text hash
 * to allow vector store operations to function in environments without internet/keys.
 */
function generatePseudoEmbedding(text: string): number[] {
  const vector: number[] = new Array(1536).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  // Fill vector using hash seed
  for (let i = 0; i < 1536; i++) {
    const value = Math.sin(hash + i) * 0.1;
    vector[i] = value;
  }

  // Normalize the mock vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / (magnitude || 1));
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('ingest.ts')) {
  runIngestion().catch(console.error);
}

export { runIngestion, generatePseudoEmbedding };
