import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import PurchaseEntry from './pages/PurchaseEntry';
import PurchaseHistory from './pages/PurchaseHistory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Expenses from './pages/Expenses';

// Instantiate react query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/purchase-entry" element={<PurchaseEntry />} />
            <Route path="/history" element={<PurchaseHistory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/expenses" element={<Expenses />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
