import { CloudRain, Droplets, Compass } from 'lucide-react';

interface WeatherCardProps {
  cityName: string;
  temp: number;
  humidity: number;
  rain1h: number;
  description: string;
  hasActiveAlert: boolean;
  alertTitle?: string;
  alertDescription?: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  cityName,
  temp,
  humidity,
  rain1h,
  description,
  hasActiveAlert,
  alertTitle,
  alertDescription,
}) => {
  return (
    <div className="card weather-card" id="weather-card-element">
      <div className="weather-header">
        <div className="weather-location">
          <h2>{cityName}</h2>
          <p>Live Telemetry</p>
        </div>
        <div className="weather-icon-pulse" style={{ color: rain1h > 0 ? '#38bdf8' : '#e2e8f0' }}>
          <CloudRain size={40} />
        </div>
      </div>

      <div className="weather-temp-area">
        <span className="weather-temp">{temp.toFixed(1)}</span>
        <span className="weather-unit">°C</span>
      </div>

      <div className="weather-desc">{description}</div>

      <div className="weather-stats">
        <div className="weather-stat-box">
          <span className="weather-stat-label">
            <Droplets size={12} style={{ marginRight: 4, display: 'inline' }} /> Humidity
          </span>
          <span className="weather-stat-val">{humidity}%</span>
        </div>
        <div className="weather-stat-box">
          <span className="weather-stat-label">
            <Compass size={12} style={{ marginRight: 4, display: 'inline' }} /> Precipitation
          </span>
          <span className="weather-stat-val">{rain1h.toFixed(1)} mm/h</span>
        </div>
      </div>

      {hasActiveAlert && (
        <div className="weather-alert-banner">
          <CloudRain size={16} />
          <div>
            <strong>{alertTitle || 'Severe Precipitation Alert'}</strong>
            {alertDescription && <p style={{ fontSize: '0.75rem', marginTop: 2 }}>{alertDescription}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
