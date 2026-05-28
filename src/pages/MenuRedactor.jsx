import React, { useState } from 'react';

const MenuRedactor = ({ menuItems, onUpdateMenu, onCreateDish, onDeleteDish }) => {
  const [editingItem, setEditingItem] = useState(null);
  const [newDish, setNewDish] = useState({
    name: '',
    price: '',
    category: 'Закуски',
    weight: '',
    description: '',
    recipe: '',
    cookingTime: '',
    ingredients: ''
  });

  const handleEdit = (item) => {
    setEditingItem({ ...item });
  };

  const handleSave = () => {
    if (editingItem) {
      onUpdateMenu(editingItem.id, editingItem);
      setEditingItem(null);
    }
  };

  const handleCreate = () => {
    if (newDish.name && newDish.price && newDish.weight) {
      onCreateDish(newDish);
      setNewDish({
        name: '',
        price: '',
        category: 'Закуски',
        weight: '',
        description: '',
        recipe: '',
        cookingTime: '',
        ingredients: ''
      });
    } else {
      alert('Заполните название, цену и вес блюда');
    }
  };
  const handleDelete = (itemId) => {
    onDeleteDish(itemId);
  };

  return (
    <div className="menu-redactor">
      <div className="admin-header">
        <button className="btn-back" onClick={() => window.location.href = '/'}>
          На главную
        </button>
        <h1>Редактор меню</h1>
      </div>
      <div className="add-dish-form">
        <h2>Добавить новое блюдо</h2>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Название *"
            value={newDish.name}
            onChange={(e) => setNewDish({...newDish, name: e.target.value})}
          />
          <input
            type="number"
            placeholder="Цена *"
            value={newDish.price}
            onChange={(e) => setNewDish({...newDish, price: e.target.value})}
          />
          <select
            value={newDish.category}
            onChange={(e) => setNewDish({...newDish, category: e.target.value})}
          >
            <option>Закуски</option>
            <option>Пицца</option>
            <option>Паста</option>
            <option>Ризотто</option>
            <option>Напитки</option>
            <option>Десерты</option>
          </select>
          <input
            type="text"
            placeholder="Вес (например: 200г) *"
            value={newDish.weight}
            onChange={(e) => setNewDish({...newDish, weight: e.target.value})}
          />
          <input
            type="text"
            placeholder="Время приготовления"
            value={newDish.cookingTime}
            onChange={(e) => setNewDish({...newDish, cookingTime: e.target.value})}
          />
          <input
            type="text"
            placeholder="Ингредиенты"
            value={newDish.ingredients}
            onChange={(e) => setNewDish({...newDish, ingredients: e.target.value})}
          />
          <textarea
            placeholder="Описание"
            value={newDish.description}
            onChange={(e) => setNewDish({...newDish, description: e.target.value})}
          />
          <textarea
            placeholder="Рецепт"
            value={newDish.recipe}
            onChange={(e) => setNewDish({...newDish, recipe: e.target.value})}
          />
          <button className="btn" onClick={handleCreate}>Добавить блюдо</button>
        </div>
      </div>
      
      <div className="dishes-list">
        <h2>Существующие блюда</h2>
        <div className="dishes-grid">
          {menuItems.map(item => (
            <div key={item.id} className="dish-card">
              {editingItem?.id === item.id ? (
                <div className="edit-mode">
                  <h3>Редактирование: {item.name}</h3>
                  <div className="edit-form">
                    <input
                      placeholder="Название"
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    />
                    <input
                      type="number"
                      placeholder="Цена"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({...editingItem, price: e.target.value})}
                    />
                    <select
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                    >
                      <option>Закуски</option>
                      <option>Пицца</option>
                      <option>Паста</option>
                      <option>Ризотто</option>
                      <option>Напитки</option>
                      <option>Десерты</option>
                    </select>
                    <input
                      placeholder="Вес"
                      value={editingItem.weight}
                      onChange={(e) => setEditingItem({...editingItem, weight: e.target.value})}
                    />
                    <input
                      placeholder="Время приготовления"
                      value={editingItem.cookingTime || ''}
                      onChange={(e) => setEditingItem({...editingItem, cookingTime: e.target.value})}
                    />
                    <input
                      placeholder="Ингредиенты"
                      value={editingItem.ingredients || ''}
                      onChange={(e) => setEditingItem({...editingItem, ingredients: e.target.value})}
                    />
                    <textarea
                      placeholder="Описание"
                      value={editingItem.description || ''}
                      onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                    />
                    <textarea
                      placeholder="Рецепт"
                      value={editingItem.recipe || ''}
                      onChange={(e) => setEditingItem({...editingItem, recipe: e.target.value})}
                    />
                    <div className="edit-actions">
                      <button className="btn btn-save" onClick={handleSave}>Сохранить</button>
                      <button className="btn btn-cancel" onClick={() => setEditingItem(null)}>Отмена</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>  
                  <h3>{item.name}</h3>
                  <p className="dish-price">{item.price} ₽</p>
                  <p className="dish-category">{item.category}</p>
                  <p className="dish-weight">{item.weight}</p>
                  {item.cookingTime && <p className="dish-time">⏱ {item.cookingTime}</p>}
                  {item.description && <p className="dish-desc">{item.description.substring(0, 80)}...</p>}
                  <div className="dish-actions">
                    <button className="btn btn-edit" onClick={() => handleEdit(item)}>Редактировать</button>
                    <button className="btn btn-delete" onClick={() => handleDelete(item.id)}>Удалить</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuRedactor;