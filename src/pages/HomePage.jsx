import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = ({ isAuthenticated }) => {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Добро пожаловать в наш ресторан</h1>
          <p>Изысканная итальянская кухня в уютной атмосфере</p>
          {!isAuthenticated ? (
            <Link to="/login" className="hero-btn">
              Забронировать столик
            </Link>
          ) : (
            <Link to="/booking" className="hero-btn">
              Забронировать столик
            </Link>
          )}
        </div>
      </section>
      <section className="menu-cta-section">
        <div className="container">
          <div className="menu-cta-content">
            <h2>Откройте для себя наше меню</h2>
            <p>Традиционные итальянские блюда, приготовленные с любовью и душой</p>
            <Link to="/menu" className="menu-cta-btn">
              Посмотреть меню →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;