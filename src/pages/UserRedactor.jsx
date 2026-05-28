import React, { useState } from 'react';

const UserRedactor = ({ users, onUpdateUser, onBlockUser, onCreateEmployee }) => {
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    role: 'waiter'
  });
  const [editingUser, setEditingUser] = useState(null);

  const handleCreateEmployee = () => {
    if (newEmployee.name && newEmployee.email && newEmployee.password) {
      onCreateEmployee(newEmployee.name, newEmployee.email, newEmployee.password, newEmployee.role);
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        role: 'waiter'
      });
    } else {
      alert('Заполните все поля');
    }
  };

  const handleUnblockUser = async (userId) => {
    if (!window.confirm('Разблокировать пользователя?')) return;
    try {
      await onUpdateUser(userId, { isBlocked: false });
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Ошибка при разблокировке пользователя');
    }
  };

  return (
    <div className="user-redactor">
      <div className="admin-header">
        <button className="btn-back" onClick={() => window.location.href = '/'}>
          На главную
        </button>
        <h1>Редактор сотрудников</h1>
      </div>

      <div className="add-user-form">
        <h2>Добавить сотрудника</h2>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Имя"
            value={newEmployee.name}
            onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
          />
          <input
            type="email"
            placeholder="Email"
            value={newEmployee.email}
            onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={newEmployee.password}
            onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
          />
          <select
            value={newEmployee.role}
            onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
          >
            <option value="waiter">Официант</option>
            <option value="chef">Повар</option>
          </select>
          <button className="btn" onClick={handleCreateEmployee}>Добавить сотрудника</button>
        </div>
      </div>

      <div className="users-list">
        <h2>Пользователи системы</h2>
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    {editingUser?.id === user.id ? (
                      <input
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                      />
                    ) : (
                      user.name
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    {editingUser?.id === user.id ? (
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                      >
                        <option value="client">Клиент</option>
                        <option value="waiter">Официант</option>
                        <option value="chef">Повар</option>
                        <option value="admin">Админ</option>
                      </select>
                    ) : (
                      user.role === 'admin' ? 'Админ' :
                      user.role === 'waiter' ? 'Официант' :
                      user.role === 'chef' ? 'Повар' : 'Клиент'
                    )}
                  </td>
                  <td className={user.isBlocked ? 'blocked' : 'active'}>
                    {user.isBlocked ? 'Заблокирован' : 'Активен'}
                  </td>
                  <td className="actions-cell">
                    {editingUser?.id === user.id ? (
                      <>
                        <button className="btn btn-small" onClick={() => {
                          onUpdateUser(user.id, editingUser);
                          setEditingUser(null);
                        }}>Сохранить</button>
                        <button className="btn btn-small" onClick={() => setEditingUser(null)}>Отмена</button>
                      </>
                    ) : (
                      <>
                        {user.role !== 'admin' && (
                          <button className="btn btn-small" onClick={() => setEditingUser(user)}>
                            Редактировать
                          </button>
                        )}
                        {!user.isBlocked && user.role !== 'admin' && (
                          <button className="btn btn-small btn-danger" onClick={() => onBlockUser(user.id)}>
                            Заблокировать
                          </button>
                        )}
                        {user.isBlocked && user.role !== 'admin' && (
                          <button className="btn btn-small" onClick={() => handleUnblockUser(user.id)}>
                            Разблокировать
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserRedactor;