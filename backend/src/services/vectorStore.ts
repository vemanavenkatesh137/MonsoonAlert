import pg from 'pg';
import { config } from '../config.js';
import { VectorChunk } from '../types.js';

const { Pool } = pg;

// Simple in-memory fallback database
const memoryDb: { content: string; metadata: string; embedding: number[] }[] = [];

let pool: pg.Pool | null = null;
let isDbConnected = false;

// Initialize Database connection pool
if (config.databaseUrl) {
  try {
    pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 5000,
    });
    console.info('[VECTOR STORE] Database connection pool configured.');
  } catch (error: any) {
    console.error('[VECTOR STORE] Failed to configure database pool:', error.message);
  }
}

/**
 * Initializes the Postgres pgvector database table if possible.
 */
export async function initVectorDb(): Promise<boolean> {
  if (!pool) {
    console.warn('[VECTOR STORE] Running in in-memory fallback mode (no DATABASE_URL).');
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      // 1. Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // 2. Create documents table with a vector dimension of 1536 (text-embedding-3-small)
      await client.query(`
        CREATE TABLE IF NOT EXISTS ndrf_documents (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT NOT NULL,
          embedding vector(1536) NOT NULL
        );
      `);

      // 3. Create index for fast cosine distance matching
      await client.query(`
        CREATE INDEX IF NOT EXISTS ndrf_embedding_idx ON ndrf_documents USING hnsw (embedding vector_cosine_ops);
      `);

      isDbConnected = true;
      console.info('[VECTOR STORE] PostgreSQL pgvector database successfully initialized.');
      return true;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[VECTOR STORE] Database initialization failed, falling back to in-memory mode. Error:', error.message);
    isDbConnected = false;
    return false;
  }
}

/**
 * Inserts a chunk into pgvector or the local fallback.
 */
export async function insertChunk(content: string, metadata: string, embedding: number[]): Promise<boolean> {
  // Always store in memory fallback as well for redundant resilience
  memoryDb.push({ content, metadata, embedding });

  if (isDbConnected && pool) {
    try {
      const query = `
        INSERT INTO ndrf_documents (content, metadata, embedding)
        VALUES ($1, $2, $3)
      `;
      // Format vector embedding as a Postgres pgvector string: '[0.1, 0.2, ...]'
      const vectorStr = `[${embedding.join(',')}]`;
      await pool.query(query, [content, metadata, vectorStr]);
      return true;
    } catch (error: any) {
      console.error('[VECTOR STORE] Failed to insert chunk to database:', error.message);
      return false;
    }
  }
  return true;
}

/**
 * Queries the database or memory store for top matches.
 */
export async function querySimilarity(queryEmbedding: number[], topK: number = 3): Promise<VectorChunk[]> {
  if (isDbConnected && pool) {
    try {
      // Cosine distance is operator <=>
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      const query = `
        SELECT id, content, metadata
        FROM ndrf_documents
        ORDER BY embedding <=> $1
        LIMIT $2
      `;
      const res = await pool.query(query, [vectorStr, topK]);
      return res.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
      }));
    } catch (error: any) {
      console.error('[VECTOR STORE] DB query similarity failed, fallback to memory search:', error.message);
    }
  }

  // Fallback: Perform local in-memory cosine similarity search
  return performMemoryCosineSimilarity(queryEmbedding, topK);
}

/**
 * Computes dot product (equivalent to cosine similarity for normalized vectors).
 */
function dotProduct(vecA: number[], vecB: number[]): number {
  let product = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

/**
 * In-memory fallback cosine search.
 */
function performMemoryCosineSimilarity(queryEmbedding: number[], topK: number): VectorChunk[] {
  if (memoryDb.length === 0) {
    console.warn('[VECTOR STORE] Memory database is empty. No documents ingested.');
    return [];
  }

  const scores = memoryDb.map((doc, idx) => {
    const similarity = dotProduct(queryEmbedding, doc.embedding);
    return { idx, similarity };
  });

  // Sort descending by similarity score
  scores.sort((a, b) => b.similarity - a.similarity);

  const topMatches = scores.slice(0, topK);
  return topMatches.map(match => ({
    content: memoryDb[match.idx].content,
    metadata: memoryDb[match.idx].metadata,
  }));
}

/**
 * Clear memory database (mainly for testing)
 */
export function clearMemoryDb() {
  memoryDb.length = 0;
}
