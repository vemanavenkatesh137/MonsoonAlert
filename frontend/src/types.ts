export type Severity = 'info' | 'warning' | 'critical';

export type AlertPhase = 'PRE_MONSOON' | 'MONSOON_ACTIVE' | 'WARNING' | 'EMERGENCY' | 'POST_DISASTER_RECOVERY';

export interface WeatherTelemetry {
  lat: number;
  lon: number;
  temp: number;
  humidity: number;
  rain1h: number;
  description: string;
  cityName: string;
  hasActiveSevereAlert: boolean;
  alertTitle?: string;
  alertDescription?: string;
}

export interface UIComponent {
  id: string;
  type: 'AlertBanner' | 'WeatherCard' | 'Checklist' | 'EvacuationMap' | 'RAGChat' | 'AssistanceForm';
  props: Record<string, any>;
}

export interface ServerDrivenLayout {
  phase: AlertPhase;
  cityName: string;
  weather: WeatherTelemetry;
  layout: string;
  components: UIComponent[];
}
