import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fetchLiveWeather, classifyWeatherThresholds } from '../services/weather.js';
import { sanitizeCoordinates } from '../services/guardrail.js';
import { ServerDrivenLayout, UIComponent, AlertPhase } from '../types.js';
import { config } from '../config.js';
import OpenAI from 'openai';

export default async function layoutRoutes(fastify: FastifyInstance) {
  fastify.get('/api/layout', { preHandler: [fastify.verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { lat: rawLat, lon: rawLon, lang = 'en' } = request.query as any;

    // 1. Sanitize input coordinates
    const { lat, lon } = sanitizeCoordinates(rawLat, rawLon);

    // 2. Fetch live weather telemetry
    const weather = await fetchLiveWeather(lat, lon);

    // 3. Classify weather alerts/phases
    const phase = classifyWeatherThresholds(weather);

    // 4. Generate dynamic UI layout based on phase
    const rawLayout = generateLayoutForPhase(phase, weather);

    // 5. Apply LLM Translation layer if target language is not English
    const targetLang = String(lang).trim().toLowerCase();
    if (targetLang && targetLang !== 'en' && config.openaiApiKey) {
      try {
        const translatedLayout = await translateLayoutJson(rawLayout, targetLang);
        return reply.send(translatedLayout);
      } catch (err: any) {
        console.error('[LAYOUT ROUTE] LLM Translation failed. Returning default English layout. Error:', err.message);
        return reply.send(rawLayout);
      }
    }

    return reply.send(rawLayout);
  });
}

function generateLayoutForPhase(phase: AlertPhase, weather: any): ServerDrivenLayout {
  const components: UIComponent[] = [];
  const cityName = weather.cityName;

  // Add the base weather display component (present in all phases)
  components.push({
    id: 'weather-card-1',
    type: 'WeatherCard',
    props: {
      cityName,
      temp: weather.temp,
      humidity: weather.humidity,
      rain1h: weather.rain1h,
      description: weather.description,
      hasActiveAlert: weather.hasActiveSevereAlert,
      alertTitle: weather.alertTitle,
      alertDescription: weather.alertDescription,
    },
  });

  switch (phase) {
    case 'EMERGENCY':
      components.unshift({
        id: 'alert-banner-1',
        type: 'AlertBanner',
        props: {
          severity: 'critical',
          title: weather.alertTitle || 'CRITICAL DISASTER EMERGENCY ALERT',
          message: weather.alertDescription || `Extreme precipitation of ${weather.rain1h}mm/hr detected. Authorities advise immediate evacuation of waterlogged areas.`,
        },
      });

      components.push({
        id: 'checklist-emergency',
        type: 'Checklist',
        props: {
          title: 'Immediate Safety Actions',
          items: [
            'Disconnect the main electric power switch (MCB) and gas line.',
            'Climb to the highest floor of your structure. Do NOT remain in basement or ground floor.',
            'Keep emergency flashlight, mobile phone, and water close at hand.',
            'Do NOT attempt to walk, swim, or drive through flowing water currents.',
            'If trapped, signal to emergency response teams using a light or bright cloth.',
          ],
        },
      });

      // Near evacuation centers based on coordinates
      components.push({
        id: 'evacuation-map-1',
        type: 'EvacuationMap',
        props: {
          lat: weather.lat,
          lon: weather.lon,
          shelters: [
            { name: 'Municipal Transit Shelter A', lat: weather.lat + 0.005, lon: weather.lon + 0.003, distance: '400m' },
            { name: 'District Higher Secondary Safe Camp', lat: weather.lat - 0.004, lon: weather.lon + 0.006, distance: '850m' },
          ],
        },
      });

      components.push({
        id: 'assistance-form-emergency',
        type: 'AssistanceForm',
        props: {
          title: 'Request Rescue / Emergency Assistance',
          fields: [
            { name: 'name', type: 'text', label: 'Reporter Name', required: true },
            { name: 'phone', type: 'tel', label: 'Contact Phone Number', required: true },
            { name: 'peopleCount', type: 'number', label: 'Number of Stranded People', required: true },
            { name: 'medicalNeeded', type: 'checkbox', label: 'Critical Medical Assistance Required', required: false },
            { name: 'situation', type: 'textarea', label: 'Brief Description of Situation & Visual Landmarks', required: true },
          ],
          action: '/api/assistance/rescue',
        },
      });
      break;

    case 'WARNING':
      components.unshift({
        id: 'alert-banner-1',
        type: 'AlertBanner',
        props: {
          severity: 'warning',
          title: 'HEAVY RAINFALL WARNING',
          message: `Heavy rain showers (${weather.rain1h}mm/h) are actively logging local areas. Limit all non-essential road travel.`,
        },
      });

      components.push({
        id: 'checklist-warning',
        type: 'Checklist',
        props: {
          title: 'Active Storm Safety Protocol',
          items: [
            'Avoid parking vehicles under old trees or near active drainage canals.',
            'Fully charge all mobile phones, power banks, and flashlights.',
            'Clear house drainage spouts and store clean drinking water.',
            'Monitor official emergency channels or local radio networks.',
          ],
        },
      });

      components.push({
        id: 'assistance-form-waterlog',
        type: 'AssistanceForm',
        props: {
          title: 'Report Localized Waterlogging',
          fields: [
            { name: 'reporter', type: 'text', label: 'Your Name', required: true },
            { name: 'street', type: 'text', label: 'Street / Landmark Address', required: true },
            { name: 'waterLevel', type: 'select', label: 'Estimated Water Level', required: true, options: ['Ankle Deep', 'Knee Deep', 'Waist Deep', 'Above Waste'] },
            { name: 'details', type: 'textarea', label: 'Additional details (e.g. blocked drain, stranded vehicle)', required: false }
          ],
          action: '/api/assistance/report-waterlog',
        },
      });
      break;

    case 'MONSOON_ACTIVE':
      components.unshift({
        id: 'alert-banner-1',
        type: 'AlertBanner',
        props: {
          severity: 'info',
          title: 'MONSOON SEASON ACTIVE',
          message: 'Active rainfall in your zone. Keep umbrella/rain gear ready. Avoid walking near open storm drains.',
        },
      });

      components.push({
        id: 'checklist-active',
        type: 'Checklist',
        props: {
          title: 'Rainy Day Safety Advisory',
          items: [
            'Watch out for open utility holes or storm sewers.',
            'Boil all tap water or drink purified/bottled water only.',
            'Drive slowly; roads are slippery with hydroplaning risks.',
          ],
        },
      });
      break;

    case 'POST_DISASTER_RECOVERY':
      components.unshift({
        id: 'alert-banner-1',
        type: 'AlertBanner',
        props: {
          severity: 'warning',
          title: 'POST-DISASTER RECOVERY MODE',
          message: 'Severe storm has cleared. Watch out for secondary hazards: structural damages, electricity leaks, snake bites.',
        },
      });

      components.push({
        id: 'checklist-recovery',
        type: 'Checklist',
        props: {
          title: 'Re-entry & Rehabilitation Steps',
          items: [
            'Do NOT turn on home electricity if rooms have standing water.',
            'Inspect wall structures and roof rafters for cracks before entering.',
            'Wear tall boots to protect against snakebites in wet debris.',
            'Discard food items that were submerged in floodwater.',
            'Drain static water pools around the house to prevent dengue/malaria mosquito breeding.',
          ],
        },
      });

      components.push({
        id: 'assistance-form-damage',
        type: 'AssistanceForm',
        props: {
          title: 'Report Structural Damage or Medical Claims',
          fields: [
            { name: 'name', type: 'text', label: 'Claimant Name', required: true },
            { name: 'address', type: 'text', label: 'Affected Property Address', required: true },
            { name: 'damageType', type: 'select', label: 'Primary Damage Type', required: true, options: ['Structural Bowing', 'Wall Collapse', 'Electrical System Loss', 'Water Contamination'] },
            { name: 'description', type: 'textarea', label: 'Detail of damage or support required', required: true }
          ],
          action: '/api/assistance/claim',
        },
      });
      break;

    case 'PRE_MONSOON':
    default:
      components.unshift({
        id: 'alert-banner-1',
        type: 'AlertBanner',
        props: {
          severity: 'info',
          title: 'PRE-MONSOON RESILIENCE ACTIVE',
          message: 'Monsoon season is approaching. Now is the best time to prepare and safeguard your household.',
        },
      });

      components.push({
        id: 'checklist-preparedness',
        type: 'Checklist',
        props: {
          title: 'Household Preparedness Guidelines',
          items: [
            'Establish an emergency contact card for every household member.',
            'Assemble a disaster survival kit (3 days of water, food, battery radio, medicine).',
            'Trim hanging branches and check roof drainage outlets.',
            'Confirm the elevation and evacuation path to the nearest safe public shelter.',
          ],
        },
      });
      break;
  }

  // RAG Chat widget is appended to all dynamic layouts
  components.push({
    id: 'rag-chat-1',
    type: 'RAGChat',
    props: {
      placeholder: 'Ask official NDRF resilience guidelines (e.g. "how to prep food during flood")',
    },
  });

  return {
    phase,
    cityName,
    weather: {
      lat: weather.lat,
      lon: weather.lon,
      temp: weather.temp,
      humidity: weather.humidity,
      rain1h: weather.rain1h,
      description: weather.description,
      cityName: weather.cityName,
      hasActiveSevereAlert: weather.hasActiveSevereAlert,
      alertTitle: weather.alertTitle,
      alertDescription: weather.alertDescription,
    },
    layout: phase.toLowerCase(),
    components,
  };
}

async function translateLayoutJson(layout: ServerDrivenLayout, targetLang: string): Promise<ServerDrivenLayout> {
  const openai = new OpenAI({ 
    apiKey: config.openaiApiKey,
    timeout: 3000 // 3 seconds request timeout
  });

  const prompt = `You are a professional localization and translation assistant for Indian languages.
Translate all displayed user-facing text inside the following JSON object into the regional language: "${targetLang}" (e.g. Hindi, Telugu, Tamil, Bengali, etc.).

Strict rules:
1. Translate ONLY display values (e.g. titles, messages, checklist items, labels, weather descriptions, city names, form labels/options, placeholder texts).
2. Do NOT translate JSON keys, layout strings, component IDs, component types ("AlertBanner", "WeatherCard", etc.), form field names (e.g., "name", "phone", "waterLevel"), coordinates, numbers, or action URLs.
3. Keep the JSON structure exactly the same.
4. Return only the raw translated JSON. Do not include markdown code block formatting (\`\`\`json) or any preamble/postamble.

JSON to translate:
${JSON.stringify(layout)}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  const content = response.choices[0].message.content || '';
  // Clean JSON formatting boundaries if the LLM outputted them despite instructions
  const cleanJson = content
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();

  return JSON.parse(cleanJson) as ServerDrivenLayout;
}
