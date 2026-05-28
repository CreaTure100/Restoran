import React, { useState } from 'react';

const BookingSidebar = ({ selectedTable, onBook, adminError }) => {
  const [timeSlot, setTimeSlot] = useState('15:00-17:00');

  const handleTimeChange = (e) => {
    let digits = e.target.value.replace(/\D/g, '');
    let formatted = '';
    // Часы начала брони
    if (digits.length >= 2){
      let hours = parseInt(digits.substring(0,2));
      if (hours > 23){
        hours = 23;
      }
      digits = hours.toString().padStart(2,'0') + digits.substring(2);
    }
    // Минуты начала брони
    if (digits.length >= 4){
      let min = parseInt(digits.substring(2,4));
      if (min > 59){
        min = 59;
      }
      digits = digits.substring(0,2) + min.toString().padStart(2,'0') + digits.substring(4);
    }
    // Часы конца брони
    if (digits.length >= 6){
      let hours = parseInt(digits.substring(4,6));
      if (hours > 23){
        hours = 23;
      }
      digits = digits.substring(0,4) + hours.toString().padStart(2,'0') + digits.substring(6);
    }
    // Минуты конца брони
    if (digits.length >= 8){
      let min = parseInt(digits.substring(6,8));
      if (min > 59){
        min = 59;
      }
      digits = digits.substring(0,6) + min.toString().padStart(2,'0');
    }
    if (digits.length > 0) {
      formatted += digits.substring(0,2);
      if (digits.length > 2) formatted += ':' + digits.substring(2,4);
      if (digits.length > 4) formatted += '-' + digits.substring(4,6);
      if (digits.length > 6) formatted += ':' + digits.substring(6,8);
    }
    setTimeSlot(formatted);
  };

  return (
    <div className="sidebar">
      <div className="legend-card">
        {[
          { type: 'free', label: 'Свободен' },
          { type: 'partial', label: 'Частично занят' },
          { type: 'booked', label: 'Занят на весь день' }
        ].map(item => (
          <div key={item.type} className="legend-item">
            <div className={`legend-dot ${item.type}`}></div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {selectedTable && (
        <div className="booking-card">
          <h3>Стол №{selectedTable.id}</h3>
          {selectedTable.slots?.length > 0 && (
            <div id="occupied-section">
              <div style={{fontSize:'0.75rem',fontWeight:600,marginBottom:'4px',letterSpacing:'0.06em',textTransform:'uppercase'}}>
                Занято
              </div>
              <div className="occupied-slots">
                {selectedTable.slots.map((slot, i) => (
                  <div key={i} className="slot">{slot}</div>
                ))}
              </div>
              <hr style={{border:'none',borderTop:'1px solid #ccc',margin:'0.6rem 0'}} />
            </div>
          )}
          <input 
            type="text" 
            className="time-input" 
            placeholder="15:00-17:00" 
            maxLength="11" 
            value={timeSlot}
            onChange={handleTimeChange}
          />
          <button className="btn" onClick={() => onBook(timeSlot)}>
            Забронировать
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingSidebar;