import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navigation = ({ isAuthenticated, user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  const userRole = user?.role || 'guest';
  
  const showAdminPanel = userRole === 'admin' || userRole === 'waiter';
  const showKitchenPanel = userRole === 'chef' || userRole === 'admin';

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <ul className="nav-links">
          <li>
            <Link to="/" className="nav-link">Главная</Link>
          </li>
          <li>
            <Link to="/menu" className="nav-link">Меню</Link>
          </li>
          
          {isAuthenticated && (
            <li>
              <Link to="/booking" className="nav-link">Бронирование</Link>
            </li>
          )}
          
          {showAdminPanel && (
            <li>
              <Link to="/admin" className="nav-link">Заказы</Link>
            </li>
          )}
          
          {showKitchenPanel && (
            <li>
              <Link to="/kitchen" className="nav-link">Кухня</Link>
            </li>
          )}
          
          {userRole === 'admin' && (
            <>
              <li>
                <Link to="/admin/menu" className="nav-link">Редактор меню</Link>
              </li>
              <li>
                <Link to="/admin/users" className="nav-link">Сотрудники</Link>
              </li>
            </>
          )}
          
          <li>
            {isAuthenticated ? (
              <div className="nav-user-menu">
                <span className="user-name">
                  {user?.name || 'Пользователь'} 
                  <span className="user-role">
                    ({userRole === 'admin' ? 'Админ' : 
                      userRole === 'waiter' ? 'Официант' : 
                      userRole === 'chef' ? 'Повар' : 'Клиент'})
                  </span>
                </span>
                <button onClick={handleLogout} className="logout-btn">Выйти</button>
              </div>
            ) : (
              <Link to="/login" className="nav-link btn-login">Вход</Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;