import React, { useState } from 'react';

const MenuPage = ({ menuItems = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const categories = ['Все', ...new Set(menuItems.map(item => item.category))];
  const filteredItems = selectedCategory === 'Все' ? menuItems : menuItems.filter(item => item.category === selectedCategory);

  const groupedItems = filteredItems.reduce((acc, item, index) => {
    const category = item.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push({ ...item, index });
    return acc;
  }, {});

  return (
    <div className="menu-page">
      <div className="menu-categories-filter">
        <div className="container">
          <div className="categories-list">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="menu-content">
        <div className="container">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="menu-category">
              <h2 className="menu-category-title">{category}</h2>
              <div className="menu-items-grid">
                {items.map((item) => (
                  <div key={item.index} className="menu-item-card">
                    <div className="menu-item-image">
                      <img src={item.image} alt={item.name} loading='lazy' />
                    </div>
                    <div className="menu-item-info">
                      <h3 className="menu-item-name">{item.name}</h3>
                      <p className="menu-item-description">
                        {item.description || 'Традиционное итальянское блюдо, приготовленное по особому рецепту'}
                      </p>
                      <div className="menu-item-meta">
                        <span className="menu-item-weight">{item.weight}</span>
                        <span className="menu-price">{item.price} ₽</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuPage;