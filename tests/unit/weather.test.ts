import { describe, it, expect } from 'vitest';
import { classifyWeatherThresholds } from '../../backend/src/services/weather.js';
import { WeatherTelemetry } from '../../backend/src/types.js';

describe('Weather Threshold Classification Rules', () => {
  const baseTelemetry: WeatherTelemetry = {
    lat: 19.0760,
    lon: 72.8777,
    temp: 28,
    humidity: 80,
    rain1h: 0,
    description: 'clear sky',
    cityName: 'Test City',
    hasActiveSevereAlert: false
  };

  it('should classify dry and clear weather as PRE_MONSOON', () => {
    const telemetry = { ...baseTelemetry };
    expect(classifyWeatherThresholds(telemetry)).toBe('PRE_MONSOON');
  });

  it('should classify light rain or drizzle as MONSOON_ACTIVE', () => {
    const telemetry = { ...baseTelemetry, rain1h: 1.5, description: 'light rain' };
    expect(classifyWeatherThresholds(telemetry)).toBe('MONSOON_ACTIVE');

    const drizzleTelemetry = { ...baseTelemetry, description: 'scattered drizzle' };
    expect(classifyWeatherThresholds(drizzleTelemetry)).toBe('MONSOON_ACTIVE');
  });

  it('should classify heavy precipitation >= 20mm/hr or storm warnings as WARNING', () => {
    const telemetry = { ...baseTelemetry, rain1h: 22, description: 'heavy intensity rain' };
    expect(classifyWeatherThresholds(telemetry)).toBe('WARNING');

    const stormTelemetry = { ...baseTelemetry, description: 'thunderstorm with rain' };
    expect(classifyWeatherThresholds(stormTelemetry)).toBe('WARNING');
  });

  it('should classify extreme precipitation >= 50mm/hr as EMERGENCY', () => {
    const telemetry = { ...baseTelemetry, rain1h: 55, description: 'extreme heavy rain' };
    expect(classifyWeatherThresholds(telemetry)).toBe('EMERGENCY');
  });

  it('should classify active severe weather alerts as EMERGENCY', () => {
    const telemetry = { ...baseTelemetry, hasActiveSevereAlert: true, description: 'cyclonic windstorm' };
    expect(classifyWeatherThresholds(telemetry)).toBe('EMERGENCY');
  });

  it('should classify coordinates ending with .99 as POST_DISASTER_RECOVERY', () => {
    const telemetry = { ...baseTelemetry, lat: 20.0099, description: 'light drizzle clearing' };
    expect(classifyWeatherThresholds(telemetry)).toBe('POST_DISASTER_RECOVERY');
  });
});
