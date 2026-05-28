import React from 'react';

const Modal = ({ isOpen, bookingInfo, quantities, menuItems = [], onConfirm, onCancel }) => {
  if (!isOpen) return null;

  const calculateTotal = () => {
    return Object.entries(quantities).reduce((sum, [idx, qty]) => 
      sum + menuItems[parseInt(idx)]?.price * qty || 0, 0
    );
  };

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <h2>Подтверждение заказа</h2>
        <div className="modal-section">
          <div className="modal-row">
            <span>Столик:</span>
            <span>№{bookingInfo?.tableId}</span>
          </div>
          <div className="modal-row">
            <span>Время:</span>
            <span>{bookingInfo?.timeSlot}</span>
          </div>
        </div>
        <div className="modal-section">
          {Object.entries(quantities).map(([idx, qty]) => {
            const item = menuItems[parseInt(idx)];
            if (!item) return null;
            return (
              <div key={idx} className="modal-row">
                <span>{item.name} × {qty}</span>
                <span>{item.price * qty} ₽</span>
              </div>
            );
          })}
          <div className="modal-row total">
            <span>Итого:</span>
            <span>{calculateTotal()} ₽</span>
          </div>
        </div>
        <div className="modal-btns">
          <button className="btn btn-outline" onClick={onCancel}>Отмена</button>
          <button className="btn" onClick={onConfirm}>Подтвердить</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;