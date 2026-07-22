import { useState, useCallback } from 'react';
import { useToast } from './components/Toast';
import { apiFetch } from './fetchClient';

export function useApi() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const request = useCallback(
    async (endpoint, options = {}) => {
      const { successMessage, errorMessage, method = 'POST', body, headers, silent = false } = options;
      setLoading(true);

      try {
        const fetchOptions = { method };
        if (body) {
          fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
        }
        if (headers) {
          fetchOptions.headers = headers;
        }

        const res = await apiFetch(endpoint, fetchOptions);
        const data = await res.json();

        if (!res.ok || data.status === 'error') {
          throw new Error(data.message || `Request failed (${res.status})`);
        }

        if (successMessage && !silent) {
          toast.success(successMessage);
        }

        return data;
      } catch (err) {
        const msg = err.message || errorMessage || 'Something went wrong';
        if (!silent) {
          toast.error(msg);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const get = useCallback(
    async (endpoint, options = {}) => {
      return request(endpoint, { ...options, method: 'GET' });
    },
    [request]
  );

  const post = useCallback(
    async (endpoint, options = {}) => {
      return request(endpoint, { ...options, method: 'POST' });
    },
    [request]
  );

  const del = useCallback(
    async (endpoint, options = {}) => {
      return request(endpoint, { ...options, method: 'DELETE' });
    },
    [request]
  );

  return { loading, request, get, post, del };
}
