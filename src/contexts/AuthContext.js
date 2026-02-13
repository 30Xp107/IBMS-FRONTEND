import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";

const getBaseUrl = () => {
  let url = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
  // Remove trailing slashes or dots
  return url.replace(/[\/\.]+$/, "");
};

const API_URL = `${getBaseUrl()}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);

  // Configure axios to send cookies with all requests - create once and memoize
  const api = useMemo(() => {
    const axiosInstance = axios.create({
      baseURL: API_URL,
      withCredentials: true, // This is crucial for sending/receiving cookies
    });

    // Interceptor to handle 401 errors and try to refresh token
    axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If we get a 401 and haven't already tried to refresh
        if (
          error.response?.status === 401 && 
          !originalRequest._retry &&
          !originalRequest.url.includes("/auth/login")
        ) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            await axios.get(`${API_URL}/auth/refresh`, {
              withCredentials: true,
            });
            // Retry the original request
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            // Refresh failed, user needs to login again
            setUser(null);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return axiosInstance;
  }, []); // Empty dependency array - create once

  const fetchUser = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = await api.get("/auth/me");
      if (response.data.success && response.data.user) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [api]);

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - api is stable due to useMemo

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    if (response.data.success && response.data.user) {
      setUser(response.data.user);
      return response.data.user;
    }
    throw new Error("Login failed");
  };

  const register = async (idNumber, name, email, password) => {
    const response = await api.post("/auth/register", { idNumber, name, email, password });
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
    api,
    refreshUser: fetchUser,
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
