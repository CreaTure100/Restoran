import React, { useState } from 'react';

const MenuSheet = ({ 
  bookingInfo, 
  quantities, 
  menuItems = [],
  dishComments = {},
  onDishCommentChange,
  onQuantityChange, 
  onPay, 
  onBack 
}) => {
  const [activeCommentIndex, setActiveCommentIndex] = useState(null);

  const calculateTotal = () => {
    return Object.entries(quantities).reduce((sum, [idx, qty]) => 
      sum + menuItems[parseInt(idx)]?.price * qty || 0, 0
    );
  };
  
  const groupedItems = menuItems.reduce((acc, item, idx) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push({ ...item, originalIndex: idx });
    return acc;
  }, {});

  return (
    <div className="menu-sheet">
      <div style={{maxWidth:'1100px',margin:'0 auto'}}>
        <div className="menu-header">
          <button className="btn-back" onClick={onBack}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Назад к столикам
          </button>
          <h1>Меню</h1>
          <div style={{width:'100px'}}></div>
        </div>

        {bookingInfo && (
          <div className="booking-info">
            <div>Столик: <span>№{bookingInfo.tableId}</span></div>
            <div>Время: <span>{bookingInfo.timeSlot}</span></div>
          </div>
        )}

        <div className="menu-categories">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="menu-category">
              <h2 className="menu-category-title">{category}</h2>
              <div className="menu-items-grid">
                {items.map(item => {
                  const qty = quantities[item.originalIndex] || 0;
                  const comment = dishComments[item.originalIndex] || '';
                  const isCommentActive = activeCommentIndex === item.originalIndex;
                  return (
                    <div key={item.id} className="menu-item-card">
                      <div className="menu-item-image">
                        <img src={item.image} alt={item.name} loading='lazy' />
                      </div>
                      <div className="menu-item-info">
                        <span className="menu-item-name">{item.name}</span>
                        <p className="menu-item-description">
                          {item.description || 'Традиционное итальянское блюдо'}
                        </p>
                        <span className="menu-item-weight">{item.weight}</span>
                      </div>
                      <div className="menu-item-right">
                        <span className="menu-price">{item.price} ₽</span>
                        {qty === 0 ? (
                          <button className="qty-btn" onClick={() => onQuantityChange(item.originalIndex, 1)}>+</button>
                        ) : (
                          <>
                            <button className="qty-btn" onClick={() => onQuantityChange(item.originalIndex, -1)}>−</button>
                            <span className="qty-num">{qty}</span>
                            <button className="qty-btn" onClick={() => onQuantityChange(item.originalIndex, 1)}>+</button>
                          </>
                        )}
                      </div>
                        {qty > 0 && (
                          <button 
                            className="btn-comment"
                            onClick={() => setActiveCommentIndex(isCommentActive ? null : item.originalIndex)}
                          >
                            {comment ? 'Изменить' : 'Комментарий'}
                          </button>
                        )}
                        {isCommentActive && qty > 0 && (
                          <input
                            type="text"
                            placeholder="Пожелания к блюду"
                            defaultValue={comment}
                            onBlur={(e) => onDishCommentChange(item.originalIndex, e.target.value)}
                            className="comment-input"
                            autoFocus
                          />
                        )}
                        {comment && qty > 0 && !isCommentActive && (
                          <div className="comment-badge">
                            <span>{comment}</span>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {calculateTotal() > 0 && (
          <button className="btn-pay" onClick={onPay}>
            Оплатить ({calculateTotal()} ₽)
          </button>
        )}
      </div>
    </div>
  );
};

export default MenuSheet;