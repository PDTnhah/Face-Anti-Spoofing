/**
 * faceApi.js — Tất cả API calls đến FastAPI backend
 */

const BASE = import.meta.env.DEV ? '' : '';

/**
 * Gửi frame ảnh đến /verify
 * @param {Blob} blob - ảnh chụp từ webcam
 * @returns {Promise<Object>} kết quả nhận diện
 */
export async function verifyFace(blob) {
  const formData = new FormData();
  formData.append('file', blob, 'capture.jpg');

  const response = await fetch(`${BASE}/verify`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Lấy danh sách người dùng từ /admin/users
 * @param {string} apiKey - Admin API Key
 */
export async function fetchUsers(apiKey) {
  const response = await fetch(`${BASE}/admin/users`, {
    headers: { 'X-Admin-Api-Key': apiKey },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Đăng ký người dùng mới vào /register
 * @param {string} apiKey - Admin API Key
 * @param {string} name - Tên người dùng
 * @param {File} imageFile - File ảnh
 */
export async function registerUser(apiKey, name, imageFile) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', imageFile);

  const response = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'X-Admin-Api-Key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Xóa người dùng theo ID
 * @param {string} apiKey - Admin API Key
 * @param {number} userId - ID người dùng
 */
export async function deleteUser(apiKey, userId) {
  const response = await fetch(`${BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Api-Key': apiKey },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
