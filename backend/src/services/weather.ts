import { WeatherTelemetry, AlertPhase } from '../types.js';
import { config } from '../config.js';
import OpenAI from 'openai';

export async function fetchLiveWeather(lat: number, lon: number): Promise<WeatherTelemetry> {
  // Check if requested coordinates belong to our preset simulation zones
  const latStr = lat.toFixed(4);
  const isSimulationZone = latStr.endsWith('99') || latStr.endsWith('27') || latStr.endsWith('60') || latStr.endsWith('26') || latStr.endsWith('89');

  if (isSimulationZone) {
    return getFallbackWeather(lat, lon, 'Simulation Preset Zone Forced');
  }

  // 1. If OpenAI key is configured but OpenWeather key is missing, use OpenAI to synthesize weather telemetry
  const hasRealOpenAiKey = config.openaiApiKey && config.openaiApiKey !== 'your_openai_api_key_here';
  const hasOpenWeatherKey = config.openweatherApiKey && config.openweatherApiKey !== 'your_openweather_api_key_here';

  if (hasRealOpenAiKey && !hasOpenWeatherKey) {
    try {
      console.info('[WEATHER SERVICE] Generating weather telemetry using OpenAI GPT-4o...');
      return await fetchWeatherFromOpenAI(lat, lon);
    } catch (err: any) {
      console.error('[WEATHER SERVICE] OpenAI weather generation failed, falling back to local simulation:', err.message);
    }
  }

  // 2. Otherwise try to use OpenWeatherMap API
  if (hasOpenWeatherKey) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${config.openweatherApiKey}&units=metric`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenWeather API returned status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;
      const temp = data.main?.temp ?? 25;
      const humidity = data.main?.humidity ?? 70;
      const rain1h = data.rain?.['1h'] ?? 0;
      const description = data.weather?.[0]?.description ?? 'clear sky';
      const cityName = data.name || `Region (${lat.toFixed(2)}, ${lon.toFixed(2)})`;

      const weatherId = data.weather?.[0]?.id ?? 800;
      const hasActiveSevereAlert = isSevereWeather(weatherId, rain1h, description);

      return {
        lat,
        lon,
        temp,
        humidity,
        rain1h,
        description,
        cityName,
        hasActiveSevereAlert,
        alertTitle: hasActiveSevereAlert ? getSevereWeatherTitle(weatherId, rain1h) : undefined,
        alertDescription: hasActiveSevereAlert ? `Severe weather condition detected: ${description}` : undefined,
      };
    } catch (error: any) {
      console.error('[WEATHER SERVICE] Live OpenWeather fetch failed, falling back to local simulation. Error:', error.message);
      return getFallbackWeather(lat, lon, error.message);
    }
  }

  // 3. Complete Offline Simulation (if no keys exist)
  return getFallbackWeather(lat, lon, 'No API keys configured');
}

/**
 * Synthesizes a realistic weather telemetry feed using OpenAI based on location, season, and time.
 */
async function fetchWeatherFromOpenAI(lat: number, lon: number): Promise<WeatherTelemetry> {
  const openai = new OpenAI({ 
    apiKey: config.openaiApiKey,
    timeout: 3000 // 3 seconds request timeout
  });
  const prompt = `You are a professional weather simulation engine. 
Synthesize a realistic weather telemetry JSON object for latitude: ${lat}, longitude: ${lon} at current local time: ${new Date().toISOString()}.
Take into account the geographical coordinates (e.g. if it is a coastal city like Mumbai/Chennai, or dry like Jodhpur) and the current monsoon season.

Generate a JSON payload matching this typescript type:
interface WeatherTelemetry {
  temp: number; // in Celsius
  humidity: number; // percentage 0-100
  rain1h: number; // precipitation in past hour in mm (0 to 100)
  description: string; // weather description, e.g. "heavy intensity rain", "clear sky", "thunderstorm"
  cityName: string; // name of the region or nearest city
  hasActiveSevereAlert: boolean; // true if rain1h >= 50 or storm condition active
  alertTitle?: string;
  alertDescription?: string;
}

Return ONLY raw valid JSON matching this schema. Do not include markdown code blocks (e.g. \`\`\`json) or explanations.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const content = response.choices[0].message.content || '';
  const cleanJson = content
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();

  const data = JSON.parse(cleanJson);
  return {
    lat,
    lon,
    temp: Number(data.temp ?? 25),
    humidity: Number(data.humidity ?? 70),
    rain1h: Number(data.rain1h ?? 0),
    description: String(data.description ?? 'clear sky'),
    cityName: String(data.cityName ?? `Region (${lat}, ${lon})`),
    hasActiveSevereAlert: !!data.hasActiveSevereAlert,
    alertTitle: data.alertTitle ? String(data.alertTitle) : undefined,
    alertDescription: data.alertDescription ? String(data.alertDescription) : undefined,
  };
}

function isSevereWeather(weatherId: number, rain1h: number, description: string): boolean {
  const idStr = String(weatherId);
  const isHeavyRainCode = ['502', '503', '504', '522', '531'].includes(idStr);
  const isSevereThunderstorm = idStr.startsWith('2') && (description.includes('heavy') || description.includes('extreme'));
  const isExtremeEvent = weatherId === 781 || description.includes('tornado') || description.includes('cyclone') || description.includes('hurricane');
  
  return rain1h >= 50 || isHeavyRainCode || isSevereThunderstorm || isExtremeEvent;
}

function getSevereWeatherTitle(weatherId: number, rain1h: number): string {
  if (rain1h >= 50) return 'Flash Flood Emergency';
  if (weatherId === 781) return 'Tornado Warning';
  if (String(weatherId).startsWith('2')) return 'Severe Thunderstorm & Lightning Warning';
  return 'Heavy Precipitation Alert';
}

export function classifyWeatherThresholds(weather: WeatherTelemetry): AlertPhase {
  // Special dry/recovery mapping logic based on location coordinates for easy manual test trigger
  const latStr = weather.lat.toFixed(4);
  if (latStr.endsWith('99')) {
    return 'POST_DISASTER_RECOVERY';
  }
  if (latStr.endsWith('27')) {
    return 'EMERGENCY';
  }
  if (latStr.endsWith('60')) {
    return 'WARNING';
  }
  if (latStr.endsWith('26')) {
    return 'MONSOON_ACTIVE';
  }

  // If extreme severe alert is flagged or rain > 50 mm/hr -> EMERGENCY
  if (weather.hasActiveSevereAlert || weather.rain1h >= 50) {
    return 'EMERGENCY';
  }

  // Rain >= 20 mm/hr or thunderstorm conditions -> WARNING
  const desc = weather.description.toLowerCase();
  const isStormy = desc.includes('thunderstorm') || desc.includes('squall') || desc.includes('heavy');
  if (weather.rain1h >= 20 || isStormy) {
    return 'WARNING';
  }

  // Rain > 0 or rainy descriptors -> MONSOON_ACTIVE
  const isRainy = desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower');
  if (weather.rain1h > 0 || isRainy) {
    return 'MONSOON_ACTIVE';
  }

  return 'PRE_MONSOON';
}

function getFallbackWeather(lat: number, lon: number, reason: string): WeatherTelemetry {
  let temp = 27;
  let humidity = 80;
  let rain1h = 0;
  let description = 'scattered clouds';
  let hasActiveSevereAlert = false;
  let alertTitle: string | undefined;
  let alertDescription: string | undefined;
  let cityName = `Fallback Zone (${lat.toFixed(2)}, ${lon.toFixed(2)})`;

  const latAbs = Math.abs(lat);
  const latStr = lat.toFixed(4);

  if (latStr.endsWith('99')) {
    temp = 29;
    humidity = 85;
    rain1h = 0;
    description = 'light drizzle clearing up';
    cityName = `Recovery Center, India`;
  } else if (latAbs >= 13.0 && latAbs <= 14.0) {
    temp = 24.5;
    humidity = 98;
    rain1h = 62.4;
    description = 'extreme heavy intensity rain / tropical storm';
    hasActiveSevereAlert = true;
    alertTitle = 'Flash Flood & Cyclone Warning';
    alertDescription = 'NDRF advises seeking shelter. Low lying areas flooded.';
    cityName = `Chennai District (Emergency Mode)`;
  } else if (latAbs >= 19.0 && latAbs <= 20.0) {
    temp = 26.0;
    humidity = 92;
    rain1h = 24.5;
    description = 'heavy intensity rain with lightning';
    cityName = `Mumbai Suburban (Warning Mode)`;
  } else if (latAbs >= 22.0 && latAbs <= 23.0) {
    temp = 28.0;
    humidity = 88;
    rain1h = 4.2;
    description = 'moderate rain showers';
    cityName = `Kolkata Division (Monsoon Active)`;
  } else {
    temp = 34.0;
    humidity = 45;
    rain1h = 0;
    description = 'clear sky / hot and dry';
    cityName = `Jodhpur Region (Preparedness Mode)`;
  }

  return {
    lat,
    lon,
    temp,
    humidity,
    rain1h,
    description: `${description} [API Fallback: ${reason}]`,
    cityName,
    hasActiveSevereAlert,
    alertTitle,
    alertDescription,
  };
}
