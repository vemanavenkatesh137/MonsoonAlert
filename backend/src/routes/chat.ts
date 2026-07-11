import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { runQueryGuardrails, sanitizeTextInput } from '../services/guardrail.js';
import { querySimilarity } from '../services/vectorStore.js';
import { generatePseudoEmbedding } from '../scripts/ingest.js';
import { config } from '../config.js';
import OpenAI from 'openai';

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.post('/api/chat', { preHandler: [fastify.verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { query, lang = 'en' } = request.body as { query: string; lang?: string };

    const cleanQuery = sanitizeTextInput(query);
    if (!cleanQuery) {
      return reply.code(400).send({ error: 'Query text cannot be empty.' });
    }

    // 1. Run Input Guardrails
    const guardrail = runQueryGuardrails(cleanQuery);
    if (!guardrail.isSafe || guardrail.deterministicResponse) {
      // Return deterministic safe warning directly
      const translatedWarning = await translateTextIfRequired(guardrail.deterministicResponse || 'Unsafe prompt flagged.', lang);
      return reply.send({
        answer: translatedWarning,
        sources: ['System Guardrail Engine'],
        phaseGuardrailTriggered: !guardrail.isSafe || guardrail.reason === 'CRITICAL_SAFETY_WARNING',
      });
    }

    // 2. Intercept friendly greetings early to improve conversational UX
    const cleanLower = cleanQuery.toLowerCase();
    const greetings = ['hi', 'hello', 'hey', 'greetings', 'help', 'who are you', 'how are you'];
    const isGreeting = greetings.some(g => cleanLower === g || cleanLower.startsWith(g + ' ') || cleanLower.endsWith(' ' + g));
    if (isGreeting) {
      const greetingResponse = 'Hello! I am your NDRF Disaster Resilience Assistant. You can ask me questions about pre-monsoon preparedness, active flood emergency safety, or post-disaster structural recovery guidelines.';
      const translatedGreeting = await translateTextIfRequired(greetingResponse, lang);
      return reply.send({
        answer: translatedGreeting,
        sources: ['Disaster Assistant Core'],
      });
    }

    // 3. Compute Embedding for query
    let embedding: number[] = [];
    const openai = config.openaiApiKey ? new OpenAI({ 
      apiKey: config.openaiApiKey,
      timeout: 3000 // 3 seconds request timeout
    }) : null;

    if (openai) {
      try {
        const embRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: cleanQuery,
        });
        embedding = embRes.data[0].embedding;
      } catch (err: any) {
        console.error('[CHAT ROUTE] OpenAI embedding fetch failed, using fallback hash embedding:', err.message);
        embedding = generatePseudoEmbedding(cleanQuery);
      }
    } else {
      embedding = generatePseudoEmbedding(cleanQuery);
    }

    // 4. Query Vector Database
    const matchedChunks = await querySimilarity(embedding, 3);
    const contextText = matchedChunks.map(chunk => chunk.content).join('\n\n');

    // 5. Synthesize Answer using bounded Prompt (RAG Anti-Hallucination)
    let synthesizedAnswer = '';
    const sources = matchedChunks.map(chunk => chunk.metadata || 'NDRF Guidelines Document');

    if (openai && contextText) {
      try {
        const systemPrompt = `You are a disaster resilience assistant representing the National Disaster Response Force (NDRF).
Answer the user's question strictly using the provided search context. 
If the context does not contain any relevant information to answer the question, you must respond EXACTLY with:
"Data unavailable. Please listen to local authorities at frequency X."
Do not use your own knowledge or speculate. Do not offer swimming, driving, or rescue steps unless they are explicitly written in the context.

Search Context:
${contextText}`;

        const compRes = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: cleanQuery }
          ],
          temperature: 0.1,
        });

        synthesizedAnswer = compRes.choices[0].message.content || '';
      } catch (err: any) {
        console.error('[CHAT ROUTE] OpenAI synthesis failed, using basic local chunk output:', err.message);
        
        const disasterKeywords = [
          'kit', 'food', 'water', 'prep', 'disaster', 'emergency', 'ndrf', 'evacuate', 
          'shelter', 'warning', 'monsoon', 'rain', 'wind', 'electric', 'recovery', 'health', 
          'storm', 'flood', 'safety', 'guideline', 'manual', 'rescue'
        ];
        const cleanLower = cleanQuery.toLowerCase();
        const hasDisasterKeyword = disasterKeywords.some(kw => cleanLower.includes(kw));

        if (matchedChunks.length > 0 && hasDisasterKeyword) {
          synthesizedAnswer = matchedChunks[0].content;
        } else {
          synthesizedAnswer = 'Data unavailable. Please listen to local authorities at frequency X.';
        }
      }
    } else {
      // Local fallback mode when OpenAI key is not set.
      // Use a basic keyword heuristic to check if the question is disaster/monsoon related.
      const disasterKeywords = [
        'kit', 'food', 'water', 'prep', 'disaster', 'emergency', 'ndrf', 'evacuate', 
        'shelter', 'warning', 'monsoon', 'rain', 'wind', 'electric', 'recovery', 'health', 
        'storm', 'flood', 'safety', 'guideline', 'manual', 'rescue'
      ];
      
      const cleanLower = cleanQuery.toLowerCase();
      const hasDisasterKeyword = disasterKeywords.some(kw => cleanLower.includes(kw));

      if (matchedChunks.length > 0 && hasDisasterKeyword) {
        synthesizedAnswer = `[Local Fallback RAG Match]:\n${matchedChunks[0].content}\n\n[Warning: OpenAI API Key was not set. Synthesis skipped.]`;
      } else {
        synthesizedAnswer = 'Data unavailable. Please listen to local authorities at frequency X.';
      }
    }

    // 6. Translate synthesized answer if language is regional
    if (lang && lang.toLowerCase() !== 'en') {
      synthesizedAnswer = await translateTextIfRequired(synthesizedAnswer, lang);
    }

    return reply.send({
      answer: synthesizedAnswer,
      sources: sources.length > 0 ? sources : ['NDRF Offline Guidelines Cache'],
    });
  });
}

async function translateTextIfRequired(text: string, lang: string): Promise<string> {
  const targetLang = String(lang).trim().toLowerCase();
  if (!targetLang || targetLang === 'en' || !config.openaiApiKey) {
    return text;
  }

  try {
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const prompt = `Translate the following statement into the language: "${targetLang}". Keep the tone formal and emergency-appropriate.
Original text:
${text}`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    return res.choices[0].message.content || text;
  } catch (err: any) {
    console.error('[CHAT TRANSLATE] Failed to translate chat answer:', err.message);
    return text;
  }
}
