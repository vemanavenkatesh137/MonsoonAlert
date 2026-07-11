import React, { useState } from 'react';
import { Check } from 'lucide-react';

interface ChecklistProps {
  title: string;
  items: string[];
}

export const Checklist: React.FC<ChecklistProps> = ({ title, items }) => {
  // Use a map to track state of checked items
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleItem = (index: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="card checklist-card" id="checklist-card-element">
      <h2>{title}</h2>
      <div className="checklist-list">
        {items.map((item, idx) => {
          const isChecked = !!checkedItems[idx];
          return (
            <div
              key={idx}
              className={`checklist-item ${isChecked ? 'checked' : ''}`}
              onClick={() => toggleItem(idx)}
              role="checkbox"
              aria-checked={isChecked}
            >
              <div className="checkbox-circle">
                {isChecked && <Check size={14} />}
              </div>
              <span className="checklist-item-text">{item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
