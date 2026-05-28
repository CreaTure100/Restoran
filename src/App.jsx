import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/App.css';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import TablesPage from './pages/TablesPage';
import OrderPage from './pages/OrderPage';
import MenuPage from './pages/MenuPage';
import KitchenPage from './pages/KitchenPage';
import Modal from './components/Modal';
import AdminPanel from './components/AdminPanel';
import apiClient from './api/client';
import MenuRedactor from './pages/MenuRedactor';
import UserRedactor from './pages/UserRedactor';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [dishComments, setDishComments] = useState({});
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [dishQueue, setDishQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [adminError, setAdminError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const menu = await apiClient.getMenu();
        setMenuItems(menu);
        const savedUser = localStorage.getItem('currentUser');
        const userObj = savedUser ? JSON.parse(savedUser) : null;
        
        if (userObj) {
          setCurrentUser(userObj);
          
          try {
            const tablesData = await apiClient.getTables();
            setTables(tablesData);
          } catch (err) {
            console.log('No tables access');
          }
          
          if (userObj.role === 'admin' || userObj.role === 'waiter') {
            try {
              const ordersData = await apiClient.getOrders();
              setOrders(ordersData);
            } catch (err) {
              console.log('No orders access');
            }
          }

          if (userObj.role === 'chef' || userObj.role === 'admin') {
            try {
              const queue = await apiClient.getKitchenQueue();
              setDishQueue(queue);
            } catch (err) {
              console.log('No kitchen access');
            }
          }
          
          if (userObj.role === 'admin') {
            try {
              const usersData = await apiClient.getUsers();
              setUsers(usersData);
            } catch (err) {
              console.log('No users access');
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    
    if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
      return <Navigate to="/" replace />;
    }
    
    return children;
  };

  const handleLogin = async (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));

    try {
      const tablesData = await apiClient.getTables();
      setTables(tablesData);
    } catch (err) {
      console.log('No tables access');
    }
    
    if (user.role === 'admin' || user.role === 'waiter') {
      try {
        const ordersData = await apiClient.getOrders();
        setOrders(ordersData);
      } catch (err) {
        console.log('No orders access');
      }
    }
    if (user.role === 'chef' || user.role === 'admin') {
      try {
        const queue = await apiClient.getKitchenQueue();
        setDishQueue(queue);
      } catch (err) {
        console.log('No kitchen access');
      }
    }
    if (user.role === 'admin') {
      try {
        const usersData = await apiClient.getUsers();
        setUsers(usersData);
      } catch (err) {
        console.log('No users access');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setSelectedTable(null);
    setBookingInfo(null);
    setQuantities({});
    setOrders([]);
    setDishQueue([]);
    setUsers([]);
    setTables([]);
  };

  const handleTableClick = (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (table && table.status !== 'booked') {
      setSelectedTable(table);
    }
  };

  const handleBook = async (timeSlot) => {
    try {
        const table = tables.find(t => t.id === selectedTable.id);
        const parseTimeSlot = (slot) => {
            const [start, end] = slot.split('-');
            const [startHour, startMin] = start.split(':').map(Number);
            const [endHour, endMin] = end.split(':').map(Number);
            return {
                start: startHour * 60 + (startMin || 0),
                end: endHour * 60 + (endMin || 0)
            };
        };
        
        const newSlot = parseTimeSlot(timeSlot);
        const Overlap = table.slots.some(existingSlot => {
            const existing = parseTimeSlot(existingSlot);
            return newSlot.start < existing.end && newSlot.end > existing.start;
        });
        
        if (Overlap) {
            alert('Это время уже забронировано!');
            return false;
        }
        
        if (newSlot.end - newSlot.start < 30) {
            alert('Минимальное время бронирования 30 минут');
            return false;
        }
        setBookingInfo({ tableId: selectedTable.id, timeSlot });
        return true;
    } catch (error) {
        alert(error.message || 'Ошибка проверки времени');
        return false;
    }
};

  const handleQuantityChange = (itemIndex, delta) => {
    setQuantities(prev => {
      const newQty = (prev[itemIndex] || 0) + delta;
      if (newQty <= 0) {
        const { [itemIndex]: _, ...rest } = prev;
        setDishComments(prevComments => {
          const {[itemIndex]: __, ...restComments} = prevComments;
          return restComments;
        });
        return rest;
      }
      return { ...prev, [itemIndex]: newQty };
    });
  };

  const handleDishCommentChange = (itemIndex, comment) => {
    setDishComments(prev => ({
      ...prev,
      [itemIndex]: comment
    }));
  };

  const handlePay = () => {
    if (Object.keys(quantities).length > 0) {
      setShowModal(true);
    }
  };

  const handleConfirmOrder = async () => {
    try {
        await apiClient.bookTable(bookingInfo.tableId, bookingInfo.timeSlot);
        const dishes = Object.entries(quantities).map(([idx, qty]) => ({
            name: menuItems[parseInt(idx)].name,
            quantity: qty,
            dishId: menuItems[parseInt(idx)].id,
            comment: dishComments[parseInt(idx)] || ''
        }));

        await apiClient.createOrder(
            bookingInfo.tableId,
            bookingInfo.timeSlot,
            dishes,
            currentUser?.name
        );

        const updatedTables = await apiClient.getTables();
        setTables(updatedTables);

        const updatedOrders = await apiClient.getOrders();
        setOrders(updatedOrders);
        
        if (currentUser?.role === 'chef' || currentUser?.role === 'admin') {
            const queue = await apiClient.getKitchenQueue();
            setDishQueue(queue);
        }

        setQuantities({});
        setDishComments({});
        setShowModal(false);
        setBookingInfo(null);
        setSelectedTable(null);
        alert('Стол забронирован и заказ подтверждён! Спасибо.');
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Ошибка при оформлении заказа');
    }
};

  const handleCancelOrder = () => {
    setShowModal(false);
  };

  const handleBackToTables = () => {
    setBookingInfo(null);
    setQuantities({});
    setDishComments({});
  };

  const handleServed = async (orderId, dishIdx) => {
    try {
      await apiClient.serveDish(orderId, dishIdx);
      const updatedOrders = await apiClient.getOrders();
      setOrders(updatedOrders);
    } catch (error) {
      console.error('Error serving dish:', error);
    }
  };

  const loadDishQueue = async () => {
    try {
      const queue = await apiClient.getKitchenQueue();
      setDishQueue(queue);
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  };

  const handleStartCooking = async (queueId) => {
    try {
      await apiClient.startCooking(queueId);
      await loadDishQueue();
      const updatedOrders = await apiClient.getOrders();
      setOrders(updatedOrders);
    } catch (error) {
      console.error('Error starting cooking:', error);
      alert('Ошибка при начале готовки');
    }
  };

  const handleCompleteDish = async (queueId) => {
    try {
      await apiClient.completeDish(queueId);
      await loadDishQueue();
      const updatedOrders = await apiClient.getOrders();
      setOrders(updatedOrders);
    } catch (error) {
      console.error('Error completing dish:', error);
      alert('Ошибка при отметке блюда');
    }
  };

  const handleViewRecipe = async (dishId) => {
    try {
      const recipe = await apiClient.getRecipe(dishId);
      return recipe;
    } catch (error) {
      console.error('Error loading recipe:', error);
      alert('Ошибка при загрузке рецепта');
      return null;
    }
  };

  const handleUpdateMenu = async (dishId, updatedData) => {
    try {
      await apiClient.updateDish(dishId, updatedData);
      const updatedMenu = await apiClient.getMenu();
      setMenuItems(updatedMenu);
      alert('Меню обновлено');
    } catch (error) {
      console.error('Error updating menu:', error);
      alert('Ошибка при обновлении меню');
    }
  };

  const handleCreateDish = async (dishData) => {
    try {
      await apiClient.createDish(dishData);
      const updatedMenu = await apiClient.getMenu();
      setMenuItems(updatedMenu);
      alert('Блюдо добавлено');
    } catch (error) {
      console.error('Error creating dish:', error);
      alert('Ошибка при добавлении блюда');
    }
  };

  const handleDeleteDish = async (dishId) => {
    if (!window.confirm('Удалить блюдо?')) return;
    try {
      await apiClient.deleteDish(dishId);
      const updatedMenu = await apiClient.getMenu();
      setMenuItems(updatedMenu);
      alert('Блюдо удалено');
    } catch (error) {
      console.error('Error deleting dish:', error);
      alert('Ошибка при удалении блюда');
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await apiClient.updateUser(userId, data);
      const updatedUsers = await apiClient.getUsers();
      setUsers(updatedUsers);
      alert('Пользователь обновлен');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Ошибка при обновлении пользователя');
    }
  };

  const handleBlockUser = async (userId) => {
    if (!window.confirm('Заблокировать пользователя?')) return;
    try {
      await apiClient.blockUser(userId);
      const updatedUsers = await apiClient.getUsers();
      setUsers(updatedUsers);
      alert('Пользователь заблокирован');
    } catch (error) {
      console.error('Error blocking user:', error);
      alert('Ошибка при блокировке пользователя');
    }
  };

  const handleCreateEmployee = async (name, email, password, role) => {
    try {
      await apiClient.createEmployee(name, email, password, role);
      const updatedUsers = await apiClient.getUsers();
      setUsers(updatedUsers);
      alert('Сотрудник добавлен');
    } catch (error) {
      console.error('Error creating employee:', error);
      alert('Ошибка при добавлении сотрудника');
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <Router basename="/TableOne/">
      <Navigation 
        isAuthenticated={!!currentUser}
        user={currentUser}
        onLogout={handleLogout}
      />
      
      <Routes>
        <Route path="/" element={<HomePage isAuthenticated={!!currentUser} />} />
        <Route path="/menu" element={<MenuPage menuItems={menuItems} />} />
        <Route path="/login" element={
          currentUser ? <Navigate to="/" /> : <LoginPage onLogin={handleLogin} />
        } />
        <Route path="/booking" element={
          <ProtectedRoute>
            {bookingInfo ? (
              <OrderPage 
                bookingInfo={bookingInfo}
                quantities={quantities}
                menuItems={menuItems}
                dishComments={dishComments}
                onQuantityChange={handleQuantityChange}
                onDishCommentChange={handleDishCommentChange}
                onPay={handlePay}
                onBack={handleBackToTables}
              />
            ) : (
              <TablesPage
                  tables={tables}
                  selectedTable={selectedTable}
                  onTableClick={handleTableClick}
                  onBook={handleBook}
                  adminError={adminError}
                />
            )}
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'waiter']}>
            <AdminPanel
              orders={orders}
              onServed={handleServed}
              onBack={() => window.location.href = '/'}
            />
          </ProtectedRoute>
        } />
        
        <Route path="/kitchen" element={
          <ProtectedRoute allowedRoles={['chef', 'admin']}>
            <KitchenPage
              queue={dishQueue}
              onStartCooking={handleStartCooking}
              onComplete={handleCompleteDish}
              onViewRecipe={handleViewRecipe}
              onBack={() => window.location.href = '/'}
            />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/menu" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MenuRedactor
              menuItems={menuItems}
              onUpdateMenu={handleUpdateMenu}
              onCreateDish={handleCreateDish}
              onDeleteDish={handleDeleteDish}
            />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserRedactor
              users={users}
              onUpdateUser={handleUpdateUser}
              onBlockUser={handleBlockUser}
              onCreateEmployee={handleCreateEmployee}
            />
          </ProtectedRoute>
        } />
      </Routes>

      <Modal 
        isOpen={showModal}
        bookingInfo={bookingInfo}
        quantities={quantities}
        menuItems={menuItems}
        onConfirm={handleConfirmOrder}
        onCancel={handleCancelOrder}
      />
    </Router>
  );
}

export default App;