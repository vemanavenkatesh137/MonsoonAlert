import React from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Severity } from '../types.js';

interface AlertBannerProps {
  severity: Severity;
  title: string;
  message: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ severity, title, message }) => {
  const getIcon = () => {
    switch (severity) {
      case 'critical':
        return <ShieldAlert size={28} />;
      case 'warning':
        return <AlertTriangle size={28} />;
      case 'info':
      default:
        return <Info size={28} />;
    }
  };

  return (
    <div className={`alert-banner ${severity}`} id="alert-banner-element">
      <div className="alert-icon-container">
        {getIcon()}
      </div>
      <div className="alert-content">
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    </div>
  );
};
