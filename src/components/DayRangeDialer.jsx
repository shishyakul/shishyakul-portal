import React, { useState, useEffect, useRef } from 'react';
import './DayRangeDialer.css';

const DAYS = [
  { id: 'MON', label: 'MON' },
  { id: 'TUE', label: 'TUE' },
  { id: 'WED', label: 'WED' },
  { id: 'THU', label: 'THU' },
  { id: 'FRI', label: 'FRI' },
  { id: 'SAT', label: 'SAT' },
  { id: 'SUN', label: 'SUN' }
];

// Helper to normalize legacy strings to start/end indices
const parseValue = (val) => {
  if (!val) return { start: 0, end: 2 };
  const str = val.toUpperCase().replace('THURS', 'THU').replace('TUES', 'TUE');
  
  if (str === 'ALL DAYS') return { start: 0, end: 6 };
  if (str.includes('-')) {
    const parts = str.split('-');
    const sIdx = DAYS.findIndex(d => d.id === parts[0]);
    const eIdx = DAYS.findIndex(d => d.id === parts[parts.length - 1]);
    return { 
      start: sIdx !== -1 ? sIdx : 0, 
      end: eIdx !== -1 ? eIdx : 2 
    };
  }
  
  // Single day
  const idx = DAYS.findIndex(d => d.id === str);
  return {
    start: idx !== -1 ? idx : 0,
    end: idx !== -1 ? idx : 0
  };
};

const formatValue = (start, end) => {
  if (start === 0 && end === 6) return 'ALL DAYS';
  if (start === end) return DAYS[start].id;
  // Format legacy mappings for consistency if needed, but we can just use 3 letters now
  let sStr = DAYS[start].id;
  let eStr = DAYS[end].id;
  // Use THURS to match legacy UI if desired, but THU is cleaner. Let's use THURS to not break old code completely.
  sStr = sStr === 'THU' ? 'THURS' : sStr === 'TUE' ? 'TUES' : sStr;
  eStr = eStr === 'THU' ? 'THURS' : eStr === 'TUE' ? 'TUES' : eStr;
  
  return `${sStr}-${eStr}`;
};

export default function DayRangeDialer({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(2);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const { start, end } = parseValue(value);
    setStartIdx(start);
    setEndIdx(end);
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        if (isOpen) {
          // Commit changes when clicking outside
          onChange(formatValue(startIdx, endIdx));
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, startIdx, endIdx, onChange]);

  const handleStartScroll = (e) => {
    const top = e.target.scrollTop;
    const idx = Math.round(top / 40);
    if (idx !== startIdx && idx >= 0 && idx < DAYS.length) {
      setStartIdx(idx);
    }
  };

  const handleEndScroll = (e) => {
    const top = e.target.scrollTop;
    const idx = Math.round(top / 40);
    if (idx !== endIdx && idx >= 0 && idx < DAYS.length) {
      setEndIdx(idx);
    }
  };

  // On open, scroll to the selected elements
  const startListRef = useRef(null);
  const endListRef = useRef(null);
  useEffect(() => {
    if (isOpen) {
      if (startListRef.current) startListRef.current.scrollTop = startIdx * 40;
      if (endListRef.current) endListRef.current.scrollTop = endIdx * 40;
    }
  }, [isOpen]); // Only run on open

  return (
    <div className="day-dialer-wrapper" ref={wrapperRef}>
      <button 
        type="button"
        className="day-dialer-btn" 
        onClick={() => setIsOpen(!isOpen)}
      >
        {value || 'Select Days'}
      </button>

      {isOpen && (
        <div className="day-dialer-popover">
          <div className="day-dialer-header">Select Day Range</div>
          <div className="day-dialer-container">
            {/* Highlight bar behind the numbers */}
            <div className="day-dialer-highlight"></div>
            
            {/* Start Column */}
            <div className="day-dialer-column" onScroll={handleStartScroll} ref={startListRef}>
              <div className="day-dialer-padding"></div>
              {DAYS.map((d, i) => (
                <div key={`start-${d.id}`} className={`day-dialer-item ${i === startIdx ? 'active' : ''}`}>
                  {d.label}
                </div>
              ))}
              <div className="day-dialer-padding"></div>
            </div>

            <div className="day-dialer-separator">to</div>

            {/* End Column */}
            <div className="day-dialer-column" onScroll={handleEndScroll} ref={endListRef}>
              <div className="day-dialer-padding"></div>
              {DAYS.map((d, i) => (
                <div key={`end-${d.id}`} className={`day-dialer-item ${i === endIdx ? 'active' : ''}`}>
                  {d.label}
                </div>
              ))}
              <div className="day-dialer-padding"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
