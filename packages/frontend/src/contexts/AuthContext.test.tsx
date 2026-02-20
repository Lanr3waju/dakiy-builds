import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import apiClient from '../lib/api';

vi.mock('../lib/api');

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with no user when no token exists', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, data: { user: null } },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('should login successfully with valid credentials', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Project_Manager' as const,
    };

    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'test-token',
          user: mockUser,
        },
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.login('test@example.com', 'password');

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });
    
    expect(localStorage.getItem('token')).toBe('test-token');
  });

  it('should handle login failure with error message', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      response: {
        data: {
          message: 'Invalid credentials',
        },
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      result.current.login('test@example.com', 'wrong-password')
    ).rejects.toThrow('Invalid credentials');

    await waitFor(() => {
      expect(result.current.error).toBe('Invalid credentials');
    });
    
    expect(result.current.user).toBeNull();
  });

  it('should logout successfully', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Project_Manager' as const,
    };

    vi.mocked(apiClient.post).mockResolvedValue({
      data: { success: true },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Manually set user state
    localStorage.setItem('token', 'test-token');
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, data: { user: mockUser } },
    });

    await result.current.logout();

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
