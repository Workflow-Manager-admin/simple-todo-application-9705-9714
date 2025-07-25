import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  Link,
  useLocation,
} from "react-router-dom";
import "./App.css";

// Color palette
const COLORS = {
  primary: "#1976d2",
  secondary: "#424242",
  accent: "#ff9800",
};

// --- API Utility ---
/**
 * Changes these endpoints if your backend is running somewhere else.
 * For demo, assume /api/auth/* and /api/todos/* endpoints.
 */
const API = {
  base: "/api",
  login: "/api/auth/login",
  register: "/api/auth/register",
  me: "/api/auth/me",
  todos: "/api/todos",
};
// Small fetch helper with token
const apiFetch = async (url, opts = {}, token) => {
  const headers = {
    Accept: "application/json",
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const resp = await fetch(url, { ...opts, headers });
  if (resp.status === 204) return null;
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || "Request failed");
  return data;
};

// --- Auth Utilities & Context ---
const AuthContext = React.createContext();

function useAuth() {
  return React.useContext(AuthContext);
}

// PUBLIC_INTERFACE
function AuthProvider({ children }) {
  // Use localStorage to persist tokens across reloads
  const [token, setToken] = useState(() =>
    localStorage.getItem("token") || ""
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);

  // Load user data if token
  useEffect(() => {
    if (token) {
      apiFetch(API.me, {}, token)
        .then((data) => setUser(data.user))
        .catch(() => {
          setUser(null);
          setToken("");
          localStorage.removeItem("token");
        })
        .finally(() => setLoading(false));
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  // PUBLIC_INTERFACE
  // Auth methods
  const login = async (email, password) => {
    const data = await apiFetch(
      API.login,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
    setToken(data.token);
    localStorage.setItem("token", data.token);
  };
  // PUBLIC_INTERFACE
  const register = async (email, password) => {
    const data = await apiFetch(
      API.register,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
    setToken(data.token);
    localStorage.setItem("token", data.token);
  };
  // PUBLIC_INTERFACE
  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// --- Route protection ---
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-vert">Loading...</div>;
  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" state={{ from: location }} replace />
  );
}

// --- Components ---

// PUBLIC_INTERFACE
function Header({ onLogout }) {
  const { user } = useAuth();
  const location = useLocation();
  // Hide on auth screens for simplicity
  if (["/login", "/register"].includes(location.pathname)) return null;
  return (
    <header className="navbar header">
      <div className="appbar-left">
        <span className="app-title">TODO APP</span>
      </div>
      <nav className="nav-links">
        <Link to="/" className="nav-link">
          All
        </Link>
        <Link to="/completed" className="nav-link">
          Completed
        </Link>
      </nav>
      <div className="header-user">
        {user && (
          <>
            <span className="user-email">{user.email || "User"}</span>
            <button onClick={onLogout} className="btn btn-logout">
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}

// PUBLIC_INTERFACE
function AddTodoFab() {
  const location = useLocation();
  if (!["/", "/completed"].includes(location.pathname)) return null;
  return (
    <Link to="/add" className="fab-btn" title="Add Todo">
      <span className="fab-plus">+</span>
    </Link>
  );
}

// PUBLIC_INTERFACE
function TodoList({ filter }) {
  // filter: "all" | "completed"
  const { token } = useAuth();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchTodos = async () => {
    setLoading(true);
    try {
      const query =
        filter === "completed" ? "?completed=true" : "";
      const data = await apiFetch(API.todos + query, {}, token);
      setTodos(data.todos || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line
  }, [filter]);
  // Remove/edit/complete handlers
  const handleDelete = async (id) => {
    try {
      await apiFetch(`${API.todos}/${id}`, { method: "DELETE" }, token);
      setTodos((t) => t.filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };
  const handleComplete = async (id, current) => {
    try {
      await apiFetch(
        `${API.todos}/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !current }),
        },
        token
      );
      setTodos((t) =>
        t.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };
  const navigate = useNavigate();
  const handleEdit = (todo) => {
    navigate(`/edit/${todo.id}`, { state: { todo } });
  };
  return (
    <main className="main-content">
      {loading && <div className="center-vert">Loading...</div>}
      {error && <div className="error-msg">{error}</div>}
      {!loading && !todos.length && (
        <div className="center-vert faded" style={{ marginTop: 32 }}>
          No todos found.
        </div>
      )}
      <ul className="todo-list">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className={
              "todo-card" + (todo.completed ? " todo-completed" : "")
            }
          >
            <div className="todo-main">
              <div className="todo-titles">
                <div className="todo-title">{todo.title}</div>
                {todo.detail && (
                  <div className="todo-detail">{todo.detail}</div>
                )}
              </div>
              <div className="todo-actions">
                <button
                  className="icon-btn"
                  title="Mark complete"
                  aria-label="Mark complete"
                  onClick={() => handleComplete(todo.id, todo.completed)}
                >
                  {todo.completed ? "✔️" : "○"}
                </button>
                <button
                  className="icon-btn"
                  title="Edit"
                  aria-label="Edit"
                  onClick={() => handleEdit(todo)}
                >
                  ✏️
                </button>
                <button
                  className="icon-btn"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => handleDelete(todo.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

// PUBLIC_INTERFACE
function TodoForm({ isEdit = false }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state;
  const [title, setTitle] = useState(state?.todo?.title || "");
  const [detail, setDetail] = useState(state?.todo?.detail || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // handle create/update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!title.trim()) throw new Error("Title is required");
      if (isEdit) {
        await apiFetch(
          `${API.todos}/${state.todo.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, detail }),
          },
          token
        );
      } else {
        await apiFetch(
          API.todos,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, detail }),
          },
          token
        );
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };
  return (
    <main className="main-content form-page">
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <h2>{isEdit ? "Edit Todo" : "Add Task"}</h2>
          <label htmlFor="todo-title" className="form-label">
            Title
          </label>
          <input
            id="todo-title"
            name="title"
            type="text"
            className="form-input"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
          />
          <label htmlFor="todo-detail" className="form-label">
            Detail
          </label>
          <input
            id="todo-detail"
            name="detail"
            type="text"
            className="form-input"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={200}
          />
          {error && <div className="error-msg">{error}</div>}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {isEdit ? "Update" : "Add"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

// PUBLIC_INTERFACE
function AuthForm({ mode = "login" }) {
  // mode: "login" | "register"
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!email.trim() || !password)
        throw new Error("Email and password required");
      if (mode === "login") {
        await login(email, password);
        navigate("/");
      } else {
        await register(email, password);
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };
  return (
    <main className="main-content form-page">
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <h2>{mode === "register" ? "Register" : "Sign In"}</h2>
          <label htmlFor="auth-email" className="form-label">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            className="form-input"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={64}
            required
          />
          <label htmlFor="auth-password" className="form-label">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required
          />
          {error && <div className="error-msg">{error}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {mode === "register" ? "Register" : "Sign In"}
            </button>
            <Link
              to={mode === "register" ? "/login" : "/register"}
              className="btn btn-alt"
            >
              {mode === "register" ? "Have an account? Login" : "New? Register"}
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

// --- App Shell ---

// PUBLIC_INTERFACE
function AppRoutes() {
  const { logout } = useAuth();
  return (
    <Router>
      <Header onLogout={logout} />
      <AddTodoFab />
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <TodoList filter="all" />
            </PrivateRoute>
          }
        />
        <Route
          path="/completed"
          element={
            <PrivateRoute>
              <TodoList filter="completed" />
            </PrivateRoute>
          }
        />
        <Route
          path="/add"
          element={
            <PrivateRoute>
              <TodoForm />
            </PrivateRoute>
          }
        />
        <Route
          path="/edit/:todoId"
          element={
            <PrivateRoute>
              <TodoForm isEdit />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<AuthForm mode="login" />} />
        <Route path="/register" element={<AuthForm mode="register" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

// PUBLIC_INTERFACE
export default function App() {
  // Light theme support by default
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
