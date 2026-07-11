import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface FormField {
  name: string;
  type: 'text' | 'tel' | 'number' | 'checkbox' | 'textarea' | 'select';
  label: string;
  required: boolean;
  options?: string[];
}

interface AssistanceFormProps {
  title: string;
  fields: FormField[];
  action: string;
}

export const AssistanceForm: React.FC<AssistanceFormProps> = ({ title, fields, action }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3051';
      const res = await fetch(`${apiBase}${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(`Submission failed with status ${res.status}`);
      }

      const data = await res.json() as { success: boolean; message: string };
      if (data.success) {
        setSuccessMessage(data.message);
        setFormData({}); // Clear form on success
      } else {
        setErrorMessage('Form submission unsuccessful.');
      }
    } catch (err: any) {
      console.error('[ASSISTANCE FORM] Submission failed:', err.message);
      setErrorMessage(`Failed to connect to backend: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card form-card" id="assistance-form-element">
      <h2>{title}</h2>

      {successMessage ? (
        <div className="form-success-alert">
          <CheckCircle size={20} />
          <div>{successMessage}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="assistance-form">
          {errorMessage && (
            <div className="form-success-alert" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
              <AlertCircle size={20} />
              <div>{errorMessage}</div>
            </div>
          )}

          {fields.map(field => {
            const value = formData[field.name] ?? '';
            return (
              <div key={field.name} className="form-group">
                {field.type !== 'checkbox' && (
                  <label htmlFor={field.name}>
                    {field.label} {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                  </label>
                )}

                {field.type === 'textarea' && (
                  <textarea
                    id={field.name}
                    className="text-input form-input"
                    rows={3}
                    value={value}
                    onChange={e => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                  />
                )}

                {field.type === 'select' && (
                  <select
                    id={field.name}
                    className="select-input form-input"
                    value={value}
                    onChange={e => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                  >
                    <option value="">-- Choose Option --</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'checkbox' && (
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      id={field.name}
                      className="form-checkbox"
                      checked={!!formData[field.name]}
                      onChange={e => handleInputChange(field.name, e.target.checked)}
                      required={field.required}
                    />
                    <span>{field.label}</span>
                  </label>
                )}

                {field.type !== 'textarea' && field.type !== 'select' && field.type !== 'checkbox' && (
                  <input
                    type={field.type}
                    id={field.name}
                    className="text-input form-input"
                    value={value}
                    onChange={e => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                  />
                )}
              </div>
            );
          })}

          <button type="submit" className="form-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting Report...' : 'Submit Request'}
          </button>
        </form>
      )}
    </div>
  );
};
