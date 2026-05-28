import axios from 'axios';

const API_URL = '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshTokenValue = localStorage.getItem('refreshToken');
    this.isRefreshing = false;
    this.failedQueue = [];

    this.client = axios.create({
      baseURL: API_URL,
    });

    this._setupInterceptors();
  }

  _setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        
        if (config.data && config.method !== 'get' && config.method !== 'delete') {
          config.headers['Content-Type'] = 'application/json';
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const isPublicEndpoint = originalRequest.url.includes('/menu') || 
                                  originalRequest.url.includes('/auth/login') || 
                                  originalRequest.url.includes('/auth/register');
        if (error.response?.status === 401 && isPublicEndpoint) {
          return Promise.reject(error);
        }
        if ((error.response?.status === 403 || error.response?.status === 401) && !originalRequest._retry && !isPublicEndpoint) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject, config: originalRequest });
            });
          }
          originalRequest._retry = true;
          this.isRefreshing = true;
          try {
            const refreshed = await this._refreshAccessToken();
            this.isRefreshing = false;

            if (refreshed) {
              this.failedQueue.forEach(pending => {
                pending.config.headers.Authorization = `Bearer ${this.accessToken}`;
                this.client(pending.config).then(pending.resolve).catch(pending.reject);
              });
              this.failedQueue = [];
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
              return this.client(originalRequest);
            } else {
              this.failedQueue.forEach(pending => pending.reject(error));
              this.failedQueue = [];
              this._handleAuthFailure();
              return Promise.reject(error);
            }
          } catch (err) {
            this.isRefreshing = false;
            this.failedQueue.forEach(pending => pending.reject(err));
            this.failedQueue = [];
            this._handleAuthFailure();
            return Promise.reject(err);
          }
        }

        if (error.response?.status === 401 && !isPublicEndpoint) {
          this._handleAuthFailure();
        }

        return Promise.reject(error);
      }
    );
  }

  async _refreshAccessToken() {
    if (!this.refreshTokenValue) return false;

    try {
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: this.refreshTokenValue,
      });

      if (response.status === 200) {
        this.setTokens(response.data.accessToken, response.data.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Refresh token error:', error.message);
    }
    return false;
  }

  _handleAuthFailure() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/login')) {
      return;
    }
    this.clearTokens();
    window.location.href = '/TableOne/login';
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshTokenValue = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshTokenValue = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async _request(method, endpoint, data = null, config = {}) {
    try {
      const requestConfig = {
        method,
        url: endpoint,
        ...config
      };

      if (data !== null && method !== 'DELETE') {
        requestConfig.data = data;
      }
      
      const response = await this.client(requestConfig);
      return response.data;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  _formatError(error) {
    if (error.response) {
      const message = error.response.data?.error || error.response.data?.message || error.response.statusText;
      return {
        status: error.response.status,
        message: message,
      };
    } else if (error.request) {
      return {
        status: 0,
        message: 'Нет ответа от сервера',
      };
    }
    return { status: 0, message: error.message };
  }

  async login(email, password) {
    try {
      const data = await this._request('POST', '/auth/login', { email, password });
      this.setTokens(data.accessToken, data.refreshToken);
      return data.user;
    } catch (error) {
      throw error;
    }
  }

  async register(name, email, password) {
    return this._request('POST', '/auth/register', { name, email, password });
  }

  async logout() {
    try {
      await this._request('POST', '/auth/logout', { 
        refreshToken: this.refreshTokenValue 
      });
    } finally {
      this.clearTokens();
    }
  }

  async getMenu() {
    return this._request('GET', '/menu');
  }

  async getTables() {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    return this._request('GET', '/tables');
  }

  async createDish(dishData) {
    return this._request('POST', '/menu', dishData);
  }

  async updateDish(dishId, data) {
    return this._request('PUT', `/menu/${dishId}`, data);
  }

  async deleteDish(dishId) {
    return this._request('DELETE', `/menu/${dishId}`, null);
  }

  async bookTable(tableId, timeSlot) {
    return this._request('POST', `/tables/${tableId}/book`, { timeSlot });
  }

  async getOrders() {
    return this._request('GET', '/orders');
  }

  async createOrder(tableId, timeSlot, dishes, clientName) {
    return this._request('POST', '/orders', { 
      tableId, 
      timeSlot, 
      dishes, 
      clientName 
    });
  }

  async serveDish(orderId, dishIndex) {
    return this._request('PUT', `/orders/${orderId}/dish/${dishIndex}/serve`);
  }

  async getKitchenQueue() {
    return this._request('GET', '/kitchen/queue');
  }

  async getRecipe(dishId) {
    return this._request('GET', `/kitchen/recipe/${dishId}`);
  }

  async startCooking(queueId) {
    return this._request('PUT', `/kitchen/dish/${queueId}/start`);
  }

  async completeDish(queueId) {
    return this._request('PUT', `/kitchen/dish/${queueId}/complete`);
  }

  async getUsers() {
    return this._request('GET', '/users');
  }

  async createEmployee(name, email, password, role) {
    return this._request('POST', '/users/employee', { 
      name, 
      email, 
      password, 
      role 
    });
  }

  async updateUser(userId, data) {
    return this._request('PUT', `/users/${userId}`, data);
  }

  async blockUser(userId) {
    return this._request('DELETE', `/users/${userId}`);
  }

  async getAdminStats() {
    return this._request('GET', '/admin/stats');
  }
}

export default new ApiClient();