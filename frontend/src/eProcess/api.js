import axios from 'axios';

/** Paths are relative to /api/e-process; uses BOSS shared axios (baseURL + session). */
function epUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `/api/e-process${suffix}`;
}

export const api = {
  get: (path, config) => axios.get(epUrl(path), config),
  post: (path, data, config) => axios.post(epUrl(path), data, config),
  put: (path, data, config) => axios.put(epUrl(path), data, config),
  patch: (path, data, config) => axios.patch(epUrl(path), data, config),
  delete: (path, config) => axios.delete(epUrl(path), config),
  postForm: (path, formData, config) =>
    axios.post(epUrl(path), formData, {
      ...config,
      headers: { ...(config?.headers || {}), 'Content-Type': 'multipart/form-data' },
    }),
};
