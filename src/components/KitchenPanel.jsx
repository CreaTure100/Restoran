import React, { useState } from 'react';

const KitchenPanel = ({ queue, onStartCooking, onComplete, onViewRecipe, onBack }) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const getStatusText = (status) => {
    switch(status) {
      case 'pending': return 'Ожидает';
      case 'cooking': return 'Готовится';
      case 'ready': return 'Готово';
      default: return 'Неизвестно';
    }
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'pending': return 'status-pending';
      case 'cooking': return 'status-cooking';
      case 'ready': return 'status-ready';
      default: return '';
    }
  };

  const handleViewRecipe = async (dishId) => {
    if (onViewRecipe) {
      const recipe = await onViewRecipe(dishId);
      setSelectedRecipe(recipe);
      setTimeout(() => setSelectedRecipe(null), 5000);
    }
  };

  return (
    <div className="kitchen-panel">
      <div className="kitchen-header">
        <button className="btn-back" onClick={onBack}>
          Назад
        </button>
        <h1>Кухня - Очередь блюд</h1>
      </div>
      
      {selectedRecipe && (
        <div className="recipe-modal">
          <div className="recipe-content">
            <h3>{selectedRecipe.name}</h3>
            <p><strong>Рецепт:</strong> {selectedRecipe.recipe}</p>
            <p><strong>Время приготовления:</strong> {selectedRecipe.cookingTime}</p>
            <p><strong>Ингредиенты:</strong> {selectedRecipe.ingredients}</p>
            {selectedRecipe.comments?.length > 0 && (
              <div className="recipe-comments">
                <strong>Комментарии к заказам:</strong>
                {selectedRecipe.comments.map((c, i) => (
                  <div key={i} className="comment-item">
                    Стол {c.tableId}: {c.comment}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setSelectedRecipe(null)}>Закрыть</button>
          </div>
        </div>
      )}
      
      <div className="kitchen-stats">
        <div className="stat-card">
          <span className="stat-value">{queue.length}</span>
          <span className="stat-label">Всего блюд</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{queue.filter(i => i.status === 'pending').length}</span>
          <span className="stat-label">Ожидают</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{queue.filter(i => i.status === 'cooking').length}</span>
          <span className="stat-label">Готовятся</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{queue.filter(i => i.status === 'ready').length}</span>
          <span className="stat-label">Готовы</span>
        </div>
      </div>
      
      <div className="kitchen-queue">
        {queue.length === 0 ? (
          <div className="empty-queue">
            <p>Нет заказов в очереди</p>
            <small>Новые заказы появятся здесь после подтверждения</small>
          </div>
        ) : (
          queue.map((item) => (
            <div key={item.id} className={`kitchen-item ${getStatusClass(item.status)}`}>
              <div className="kitchen-item-info">
                <div className="kitchen-item-header">
                  <span className="table-number">Стол {item.tableId}</span>
                  <span className="dish-time">{item.timeSlot}</span>
                </div>
                <div className="dish-details">
                  <span className="dish-name">{item.dishName}</span>
                  <span className="dish-quantity">x{item.quantity}</span>
                </div>
                <span className={`dish-status ${getStatusClass(item.status)}`}>
                  {getStatusText(item.status)}
                </span>
                {item.comment && (
                  <div className="dish-comment">
                    <span className="comment-text">📝 {item.comment}</span>
                  </div>
                )}
              </div>
              <div className="kitchen-actions">
                <button 
                  className="btn-recipe"
                  onClick={() => handleViewRecipe(item.dishId)}
                >
                  Рецепт
                </button>
                {item.status === 'pending' && (
                  <button 
                    className="btn-start"
                    onClick={() => onStartCooking(item.id)}
                  >
                    Начать
                  </button>
                )}
                {item.status === 'cooking' && (
                  <button 
                    className="btn-complete"
                    onClick={() => onComplete(item.id)}
                  >
                    Готовится
                  </button>
                )}
                {item.status === 'ready' && (
                  <button 
                    className="btn-ready"
                    disabled
                  >
                    Готово
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KitchenPanel;